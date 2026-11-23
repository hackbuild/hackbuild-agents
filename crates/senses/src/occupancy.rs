//! An occupancy grid built from eye depth renders: floor hits clear the
//! cells along their ray, hits below head height mark obstacles after two
//! hits, the agent's own footprint is always free. Paths are A* on the grid
//! with obstacles inflated by the agent radius and no corner cutting, then
//! line of sight smoothing. Frontiers are free reachable cells beside
//! unknown cells, grouped into buckets and sorted by walking distance.
//! Written for this library from an earlier unpublished perception prototype by the same author.

use crate::math::{Camera, Vec3};
use std::cmp::Ordering;
use std::collections::BinaryHeap;

pub const UNKNOWN: u8 = 0;
pub const FREE: u8 = 1;
pub const OCCUPIED: u8 = 2;

#[derive(Clone, Copy, Debug)]
pub struct GridConfig {
    /// cells per side (prototype 220)
    pub cells: usize,
    /// cell size in metres (prototype 0.1)
    pub cell: f64,
    /// obstacle inflation and the always free footprint, in cells
    pub radius: i32,
    /// hits below this height mark floor (m)
    pub floor_y: f64,
    /// hits below this height and above the floor mark obstacles (m)
    pub head_y: f64,
    /// depth samples beyond this are ignored (m)
    pub max_range: f64,
    /// hits an obstacle needs before it counts
    pub hits_to_mark: u8,
    /// frontier bucket side in cells
    pub bucket: usize,
}

impl Default for GridConfig {
    fn default() -> Self {
        GridConfig {
            cells: 220,
            cell: 0.1,
            radius: 2,
            floor_y: 0.05,
            head_y: 1.75,
            max_range: 6.5,
            hits_to_mark: 2,
            bucket: 6,
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub struct Frontier {
    pub pos: Vec3,
    /// walking distance in metres
    pub dist: f64,
    /// cells in the bucket
    pub size: usize,
}

pub struct OccupancyGrid {
    pub cfg: GridConfig,
    ox: f64,
    oz: f64,
    state: Vec<u8>,
    hits: Vec<u8>,
    dead: Vec<Vec3>,
    rev: u64,
    walk_rev: u64,
    walk: Vec<u8>,
}

#[derive(Clone, Copy, PartialEq)]
struct Open {
    f: f64,
    i: usize,
}
impl Eq for Open {}
impl Ord for Open {
    fn cmp(&self, o: &Self) -> Ordering {
        o.f.partial_cmp(&self.f)
            .unwrap_or(Ordering::Equal)
            .then_with(|| o.i.cmp(&self.i))
    }
}
impl PartialOrd for Open {
    fn partial_cmp(&self, o: &Self) -> Option<Ordering> {
        Some(self.cmp(o))
    }
}

impl OccupancyGrid {
    /// A grid centred on (cx, cz).
    pub fn new(cfg: GridConfig, cx: f64, cz: f64) -> OccupancyGrid {
        let n = cfg.cells * cfg.cells;
        let half = cfg.cells as f64 * cfg.cell / 2.0;
        OccupancyGrid {
            cfg,
            ox: cx - half,
            oz: cz - half,
            state: vec![UNKNOWN; n],
            hits: vec![0; n],
            dead: Vec::new(),
            rev: 1,
            walk_rev: 0,
            walk: vec![0; n],
        }
    }
    pub fn revision(&self) -> u64 {
        self.rev
    }
    pub fn cells(&self) -> &[u8] {
        &self.state
    }
    fn ix(&self, x: f64) -> isize {
        libm::floor((x - self.ox) / self.cfg.cell) as isize
    }
    fn iz(&self, z: f64) -> isize {
        libm::floor((z - self.oz) / self.cfg.cell) as isize
    }
    fn cx(&self, i: usize) -> f64 {
        self.ox + (i as f64 + 0.5) * self.cfg.cell
    }
    fn cz(&self, j: usize) -> f64 {
        self.oz + (j as f64 + 0.5) * self.cfg.cell
    }
    fn inb(&self, i: isize, j: isize) -> bool {
        let n = self.cfg.cells as isize;
        i >= 0 && j >= 0 && i < n && j < n
    }
    fn idx(&self, i: isize, j: isize) -> usize {
        j as usize * self.cfg.cells + i as usize
    }
    pub fn at(&self, x: f64, z: f64) -> u8 {
        let (i, j) = (self.ix(x), self.iz(z));
        if self.inb(i, j) {
            self.state[self.idx(i, j)]
        } else {
            UNKNOWN
        }
    }

    /// One observation of a cell: an obstacle hit or a floor hit.
    pub fn mark(&mut self, x: f64, z: f64, obstacle: bool) {
        let (i, j) = (self.ix(x), self.iz(z));
        if !self.inb(i, j) {
            return;
        }
        let e = self.idx(i, j);
        if obstacle {
            if self.hits[e] < 6 {
                self.hits[e] += 1;
            }
            if self.hits[e] >= self.cfg.hits_to_mark && self.state[e] != OCCUPIED {
                self.state[e] = OCCUPIED;
                self.rev += 1;
            }
        } else {
            if self.hits[e] > 0 {
                self.hits[e] -= 1;
            }
            if self.hits[e] == 0 && self.state[e] != FREE {
                self.state[e] = FREE;
                self.rev += 1;
            }
        }
    }

    /// Integrates a depth image (metres along the view ray, row 0 at the
    /// top, `dw` by `dh`) seen through `cam`, then frees the agent's
    /// footprint at `agent`. Every second pixel in each direction is used.
    pub fn integrate(
        &mut self,
        cam: &Camera,
        depth: &[f32],
        dw: usize,
        dh: usize,
        far: f64,
        agent: Vec3,
    ) {
        let e = cam.pos;
        for y in (1..dh).step_by(2) {
            for x in (0..dw).step_by(2) {
                let h = depth[y * dw + x] as f64;
                if h >= far * 0.97 || h < 0.12 || h > self.cfg.max_range {
                    continue;
                }
                let dir = cam.ray(
                    (x as f64 + 0.5) / dw as f64 * 2.0 - 1.0,
                    1.0 - (y as f64 + 0.5) / dh as f64 * 2.0,
                );
                let p = e.add(dir.scale(h));
                if p.y < self.cfg.floor_y {
                    self.mark(p.x, p.z, false);
                    let (rx, rz) = (p.x - e.x, p.z - e.z);
                    let c = libm::hypot(rx, rz);
                    let l = libm::floor(c / self.cfg.cell) as usize;
                    for k in 1..l {
                        let i = self.ix(e.x + rx * k as f64 / l as f64);
                        let j = self.iz(e.z + rz * k as f64 / l as f64);
                        if self.inb(i, j) {
                            let q = self.idx(i, j);
                            if self.state[q] == UNKNOWN {
                                self.state[q] = FREE;
                                self.rev += 1;
                            }
                        }
                    }
                } else if p.y < self.cfg.head_y {
                    self.mark(p.x, p.z, true);
                }
            }
        }
        self.free_around(agent);
    }

    /// Frees the cells within the footprint radius of `p`.
    pub fn free_around(&mut self, p: Vec3) {
        let r = self.cfg.radius as isize;
        let r2 = r * r + 1;
        let (ci, cj) = (self.ix(p.x), self.iz(p.z));
        for dj in -r..=r {
            for di in -r..=r {
                let (i, j) = (ci + di, cj + dj);
                if self.inb(i, j) && di * di + dj * dj <= r2 {
                    let q = self.idx(i, j);
                    if self.state[q] != FREE {
                        self.state[q] = FREE;
                        self.hits[q] = 0;
                        self.rev += 1;
                    }
                }
            }
        }
    }

    /// Marks an obstacle where walking stalled.
    pub fn bump(&mut self, x: f64, z: f64) {
        let (i, j) = (self.ix(x), self.iz(z));
        if self.inb(i, j) {
            let q = self.idx(i, j);
            self.state[q] = OCCUPIED;
            self.hits[q] = 6;
            self.rev += 1;
        }
    }

    /// Walkable cells: free and outside the inflated obstacles. Cached by revision.
    pub fn walkable(&mut self) -> &[u8] {
        if self.walk_rev == self.rev {
            return &self.walk;
        }
        let n = self.cfg.cells as isize;
        let r = self.cfg.radius as isize;
        let r2 = r * r + 1;
        for (w, s) in self.walk.iter_mut().zip(self.state.iter()) {
            *w = u8::from(*s == FREE);
        }
        for j in 0..n {
            for i in 0..n {
                if self.state[(j * n + i) as usize] != OCCUPIED {
                    continue;
                }
                for dj in -r..=r {
                    for di in -r..=r {
                        if di * di + dj * dj > r2 {
                            continue;
                        }
                        let (a, b) = (i + di, j + dj);
                        if a >= 0 && b >= 0 && a < n && b < n {
                            self.walk[(b * n + a) as usize] = 0;
                        }
                    }
                }
            }
        }
        self.walk_rev = self.rev;
        &self.walk
    }

    pub fn can_stand(&mut self, x: f64, z: f64) -> bool {
        let (i, j) = (self.ix(x), self.iz(z));
        if !self.inb(i, j) {
            return false;
        }
        let q = self.idx(i, j);
        self.walkable()[q] == 1
    }

    fn nearest_walkable(&mut self, i: isize, j: isize, r: isize) -> Option<(isize, isize)> {
        let n = self.cfg.cells as isize;
        let w = self.walkable();
        if i >= 0 && j >= 0 && i < n && j < n && w[(j * n + i) as usize] == 1 {
            return Some((i, j));
        }
        let mut best = None;
        let mut bd = isize::MAX;
        for dj in -r..=r {
            for di in -r..=r {
                let (a, b) = (i + di, j + dj);
                if a >= 0
                    && b >= 0
                    && a < n
                    && b < n
                    && w[(b * n + a) as usize] == 1
                    && di * di + dj * dj < bd
                {
                    bd = di * di + dj * dj;
                    best = Some((a, b));
                }
            }
        }
        best
    }

    /// Walking distance in cells from `p` to every reachable cell, -1 elsewhere.
    pub fn flood(&mut self, p: Vec3) -> Vec<i32> {
        let n = self.cfg.cells;
        let mut g = vec![-1i32; n * n];
        let Some((i, j)) = self.nearest_walkable(self.ix(p.x), self.iz(p.z), 4) else {
            return g;
        };
        let w = self.walkable().to_vec();
        let mut q = std::collections::VecDeque::new();
        let s = j as usize * n + i as usize;
        g[s] = 0;
        q.push_back(s);
        while let Some(o) = q.pop_front() {
            let (a, b) = ((o % n) as isize, (o / n) as isize);
            for (di, dj) in [(1, 0), (-1, 0), (0, 1), (0, -1)] {
                let (x, y) = (a + di, b + dj);
                if x < 0 || y < 0 || x >= n as isize || y >= n as isize {
                    continue;
                }
                let c = y as usize * n + x as usize;
                if g[c] < 0 && w[c] == 1 {
                    g[c] = g[o] + 1;
                    q.push_back(c);
                }
            }
        }
        g
    }

    /// A* from `a` to `b` over walkable cells with no corner cutting, then
    /// line of sight smoothing; waypoints at cell centres, y = 0.
    pub fn path(&mut self, a: Vec3, b: Vec3) -> Option<Vec<Vec3>> {
        let n = self.cfg.cells;
        let (ei, ej) = (self.ix(b.x), self.iz(b.z));
        if !self.inb(ei, ej) || !self.inb(self.ix(a.x), self.iz(a.z)) {
            return None;
        }
        let (si, sj) = self.nearest_walkable(self.ix(a.x), self.iz(a.z), 4)?;
        let (ei, ej) = self.nearest_walkable(ei, ej, 3)?;
        let w = self.walkable().to_vec();
        let start = sj as usize * n + si as usize;
        let goal = ej as usize * n + ei as usize;
        let mut dist = vec![f64::INFINITY; n * n];
        let mut from = vec![usize::MAX; n * n];
        let mut closed = vec![false; n * n];
        let hgt = |i: usize| libm::hypot((i % n) as f64 - ei as f64, (i / n) as f64 - ej as f64);
        let mut open = BinaryHeap::new();
        dist[start] = 0.0;
        open.push(Open {
            f: hgt(start),
            i: start,
        });
        let mut found = false;
        while let Some(Open { i: g, .. }) = open.pop() {
            if closed[g] {
                continue;
            }
            closed[g] = true;
            if g == goal {
                found = true;
                break;
            }
            let (f, u) = ((g % n) as isize, (g / n) as isize);
            for dj in -1isize..=1 {
                for di in -1isize..=1 {
                    if di == 0 && dj == 0 {
                        continue;
                    }
                    let (x, y) = (f + di, u + dj);
                    if x < 0 || y < 0 || x >= n as isize || y >= n as isize {
                        continue;
                    }
                    let m = y as usize * n + x as usize;
                    if w[m] == 0 || closed[m] {
                        continue;
                    }
                    if di != 0
                        && dj != 0
                        && (w[u as usize * n + x as usize] == 0
                            || w[y as usize * n + f as usize] == 0)
                    {
                        continue;
                    }
                    let v = dist[g]
                        + if di != 0 && dj != 0 {
                            core::f64::consts::SQRT_2
                        } else {
                            1.0
                        };
                    if v < dist[m] {
                        dist[m] = v;
                        from[m] = g;
                        open.push(Open {
                            f: v + hgt(m),
                            i: m,
                        });
                    }
                }
            }
        }
        if !found {
            return None;
        }
        let mut cells = vec![goal];
        while let Some(&k) = cells.last() {
            if k == start {
                break;
            }
            cells.push(from[k]);
        }
        cells.reverse();
        let sight = |p: usize, q: usize| {
            let (f, u, x, y) = (
                (p % n) as f64,
                (p / n) as f64,
                (q % n) as f64,
                (q / n) as f64,
            );
            let steps = ((x - f).abs().max((y - u).abs()) * 2.0) as usize;
            for s in 0..=steps {
                let t = if steps == 0 {
                    0.0
                } else {
                    s as f64 / steps as f64
                };
                let m = libm::round(f + (x - f) * t) as usize;
                let v = libm::round(u + (y - u) * t) as usize;
                if w[v * n + m] == 0 {
                    return false;
                }
            }
            true
        };
        let mut out = vec![cells[0]];
        let mut p = 0;
        while p < cells.len() - 1 {
            let mut k = cells.len() - 1;
            while k > p + 1 && !sight(cells[p], cells[k]) {
                k -= 1;
            }
            out.push(cells[k]);
            p = k;
        }
        Some(
            out.into_iter()
                .map(|c| Vec3::new(self.cx(c % n), 0.0, self.cz(c / n)))
                .collect(),
        )
    }

    /// Unexplored edges reachable from `p`, nearest first.
    pub fn frontiers(&mut self, p: Vec3) -> Vec<Frontier> {
        let n = self.cfg.cells;
        let fl = self.flood(p);
        let bk = self.cfg.bucket;
        let nb = n.div_ceil(bk);
        // per bucket: count, nearest cell distance, nearest cell
        let mut buckets: Vec<(usize, i32, usize)> = vec![(0, i32::MAX, 0); nb * nb];
        for j in 1..n - 1 {
            for i in 1..n - 1 {
                let e = j * n + i;
                let s = &self.state;
                if fl[e] < 0
                    || (s[e + 1] != UNKNOWN
                        && s[e - 1] != UNKNOWN
                        && s[e + n] != UNKNOWN
                        && s[e - n] != UNKNOWN)
                {
                    continue;
                }
                let b = &mut buckets[(j / bk) * nb + i / bk];
                b.0 += 1;
                if fl[e] < b.1 {
                    b.1 = fl[e];
                    b.2 = e;
                }
            }
        }
        let mut out: Vec<Frontier> = buckets
            .into_iter()
            .filter(|b| b.0 >= 3)
            .map(|b| Frontier {
                pos: Vec3::new(self.cx(b.2 % n), 0.0, self.cz(b.2 / n)),
                dist: b.1 as f64 * self.cfg.cell,
                size: b.0,
            })
            .filter(|f| !self.dead.iter().any(|d| d.sub(f.pos).length() < 0.7))
            .collect();
        out.sort_by(|a, b| a.dist.partial_cmp(&b.dist).unwrap_or(Ordering::Equal));
        out
    }

    /// A frontier that did not grow the map: never offered again.
    pub fn mark_dead(&mut self, p: Vec3) {
        self.dead.push(p);
    }

    /// Known free area in square metres and occupied cell count.
    pub fn known(&self) -> (f64, usize) {
        let free = self.state.iter().filter(|&&s| s == FREE).count();
        let occ = self.state.iter().filter(|&&s| s == OCCUPIED).count();
        (free as f64 * self.cfg.cell * self.cfg.cell, occ)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A room with a wall across it and a gap at one end, all cells known.
    fn room() -> OccupancyGrid {
        let mut g = OccupancyGrid::new(
            GridConfig {
                cells: 60,
                ..Default::default()
            },
            0.0,
            0.0,
        );
        for j in 0..60 {
            for i in 0..60 {
                let (x, z) = (g.cx(i), g.cz(j));
                g.mark(x, z, false);
                if j == 30 && i < 45 {
                    g.mark(x, z, true);
                    g.mark(x, z, true);
                }
            }
        }
        g
    }

    #[test]
    fn path_goes_round_the_wall_and_keeps_clear() {
        let mut g = room();
        let p = g
            .path(Vec3::new(-2.0, 0.0, -1.5), Vec3::new(-2.0, 0.0, 1.5))
            .expect("path");
        // the gap is at x above 1.5 m (cell 45 of 60 at 0.1 m, computed)
        assert!(p.iter().any(|q| q.x > 1.5), "{p:?}");
        for q in &p {
            assert!(g.can_stand(q.x, q.z));
        }
        g.bump(1.9, 0.05);
        g.bump(2.1, 0.05);
        g.bump(2.3, 0.05);
        g.bump(2.5, 0.05);
        g.bump(2.7, 0.05);
        g.bump(2.9, 0.05);
        assert!(
            g.path(Vec3::new(-2.0, 0.0, -1.5), Vec3::new(-2.0, 0.0, 1.5))
                .is_none()
        );
    }

    #[test]
    fn frontiers_sit_on_the_edge_of_the_known_area() {
        let mut g = OccupancyGrid::new(
            GridConfig {
                cells: 60,
                ..Default::default()
            },
            0.0,
            0.0,
        );
        for j in 20..40 {
            for i in 20..40 {
                let (x, z) = (g.cx(i), g.cz(j));
                g.mark(x, z, false);
            }
        }
        let f = g.frontiers(Vec3::new(0.0, 0.0, 0.0));
        assert!(!f.is_empty());
        assert!(f.windows(2).all(|w| w[0].dist <= w[1].dist));
        let first = f[0].pos;
        g.mark_dead(first);
        assert!(
            g.frontiers(Vec3::default())
                .iter()
                .all(|x| x.pos.sub(first).length() >= 0.7)
        );
    }

    #[test]
    fn integrates_a_depth_image_of_floor_and_a_wall() {
        // eye at 0.6 m looking down 0.3 rad along +Z at a wall 3 m ahead: depth by ray casting
        let cam = Camera::look(
            Vec3::new(0.0, 0.6, 0.0),
            0.0,
            -0.3,
            74.0,
            96.0 / 54.0,
            0.05,
            12.0,
        );
        let (dw, dh) = (96, 54);
        let mut depth = vec![12.0f32; dw * dh];
        for y in 0..dh {
            for x in 0..dw {
                let d = cam.ray(
                    (x as f64 + 0.5) / dw as f64 * 2.0 - 1.0,
                    1.0 - (y as f64 + 0.5) / dh as f64 * 2.0,
                );
                let t_wall = if d.z > 1e-6 { 3.0 / d.z } else { f64::INFINITY };
                let t_floor = if d.y < -1e-6 {
                    0.6 / -d.y
                } else {
                    f64::INFINITY
                };
                let t = t_wall.min(t_floor);
                if t < 12.0 {
                    depth[y * dw + x] = t as f32;
                }
            }
        }
        let mut g = OccupancyGrid::new(GridConfig::default(), 0.0, 0.0);
        g.integrate(&cam, &depth, dw, dh, 12.0, Vec3::default());
        // every second pixel leaves gaps between cells, so look along the wall
        let wall = (-5..=5)
            .filter(|k| {
                [2.95, 3.05]
                    .iter()
                    .any(|&z| g.at(*k as f64 * 0.1, z) == OCCUPIED)
            })
            .count();
        assert!(wall >= 6, "wall cells {wall}");
        assert_eq!(g.at(0.0, 2.0), FREE);
        assert_eq!(g.at(0.0, -3.0), UNKNOWN);
        let (free, occ) = g.known();
        assert!(free > 1.0 && occ > 10, "{free} {occ}");
    }
}
