//! wasm-bindgen surface. Flat layouts: a camera is 16 numbers (position,
//! right, up, back, vertical fov in degrees, aspect, near, far); points are
//! `x y z` per point.

use crate::golden;
use crate::loom::{LoomConfig, Looming, angular_size, time_to_contact};
use crate::math::{Camera, Vec3};
use crate::occupancy::{GridConfig, OccupancyGrid as Grid};
use crate::odour::{
    OdourConfig, OdourField as Field, Sniffer as Sn, Source, TrackMode, Tracker as Tr,
};
use crate::saliency::{Channels, Saliency as Sal, SaliencyConfig};
use crate::vision::{PerceptMemory as Mem, Sighting, VisionProfile};
use agent_rng::Mulberry32;
use wasm_bindgen::prelude::*;

fn cam(c: &[f64]) -> Result<Camera, JsError> {
    if c.len() < 16 {
        return Err(JsError::new(
            "camera needs 16 numbers: position, right, up, back, fov, aspect, near, far",
        ));
    }
    let v = |i: usize| Vec3::new(c[i], c[i + 1], c[i + 2]);
    Ok(Camera {
        pos: v(0),
        right: v(3),
        up: v(6),
        back: v(9),
        fov_y: c[12],
        aspect: c[13],
        near: c[14],
        far: c[15],
    })
}

fn points(p: &[f64]) -> Vec<Vec3> {
    (0..p.len() / 3)
        .map(|i| Vec3::new(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]))
        .collect()
}

#[wasm_bindgen(js_name = goldenTrace)]
pub fn golden_trace(seed: u32) -> Vec<f64> {
    golden::trace(seed)
}

/// A camera at a position looking along yaw and pitch, as 16 numbers.
#[wasm_bindgen(js_name = cameraLook)]
pub fn camera_look(
    x: f64,
    y: f64,
    z: f64,
    yaw: f64,
    pitch: f64,
    fov: f64,
    aspect: f64,
    near: f64,
    far: f64,
) -> Vec<f64> {
    let c = Camera::look(Vec3::new(x, y, z), yaw, pitch, fov, aspect, near, far);
    vec![
        c.pos.x, c.pos.y, c.pos.z, c.right.x, c.right.y, c.right.z, c.up.x, c.up.y, c.up.z,
        c.back.x, c.back.y, c.back.z, c.fov_y, c.aspect, c.near, c.far,
    ]
}

#[wasm_bindgen(js_name = angularSize)]
pub fn angular_size_js(size: f64, dist: f64) -> f64 {
    angular_size(size, dist)
}

#[wasm_bindgen(js_name = timeToContact)]
pub fn time_to_contact_js(prev: f64, angle: f64, dt: f64) -> f64 {
    time_to_contact(prev, angle, dt)
}

#[wasm_bindgen]
pub struct Saliency(Sal);

#[wasm_bindgen]
impl Saliency {
    /// `opts`: width, height, gain, threshold, fixation median, ior seconds,
    /// snap angle, ground y, then the four channel weights.
    #[wasm_bindgen(constructor)]
    pub fn new(opts: &[f64], seed: u32) -> Result<Saliency, JsError> {
        let d = SaliencyConfig::default();
        let o = |i: usize, v: f64| opts.get(i).copied().filter(|x| x.is_finite()).unwrap_or(v);
        let dc = Channels::default();
        let cfg = SaliencyConfig {
            width: o(0, d.width as f64) as usize,
            height: o(1, d.height as f64) as usize,
            gain: o(2, d.gain),
            threshold: o(3, d.threshold),
            fixation_median: o(4, d.fixation_median),
            ior_seconds: o(5, d.ior_seconds),
            snap_angle: o(6, d.snap_angle),
            ground_y: o(7, d.ground_y),
            channels: Channels {
                intensity: o(8, dc.intensity),
                blue_yellow: o(9, dc.blue_yellow),
                edges: o(10, dc.edges),
                motion: o(11, dc.motion),
            },
        };
        if cfg.width < 8 || cfg.height < 8 {
            return Err(JsError::new("saliency grid must be at least 8 by 8"));
        }
        Ok(Saliency(Sal::new(cfg, seed)))
    }
    #[wasm_bindgen(getter, js_name = mapWidth)]
    pub fn map_width(&self) -> usize {
        self.0.map_width()
    }
    #[wasm_bindgen(getter, js_name = mapHeight)]
    pub fn map_height(&self) -> usize {
        self.0.map_height()
    }
    pub fn update(
        &mut self,
        frame: &[u8],
        width: usize,
        height: usize,
        now: f64,
        camera: &[f64],
    ) -> Result<Vec<f32>, JsError> {
        if frame.len() < width * height * 4 {
            return Err(JsError::new("frame is shorter than width * height * 4"));
        }
        let c = cam(camera)?;
        Ok(self.0.update(frame, width, height, now, &c).to_vec())
    }
    pub fn map(&self) -> Vec<f32> {
        self.0.map().to_vec()
    }
    #[wasm_bindgen(js_name = biasPoint)]
    pub fn bias_point(&mut self, x: f64, y: f64, z: f64, weight: f64) {
        self.0.bias_point(Vec3::new(x, y, z), weight);
    }
    #[wasm_bindgen(js_name = biasUv)]
    pub fn bias_uv(&mut self, u: f64, v: f64, weight: f64) {
        self.0.bias_uv(u, v, weight);
    }
    pub fn inhibit(&mut self, x: f64, y: f64, z: f64, until: f64) {
        self.0.inhibit(Vec3::new(x, y, z), until);
    }
    pub fn inhibited(&self) -> usize {
        self.0.inhibited()
    }
    pub fn ready(&self, now: f64) -> bool {
        self.0.ready(now)
    }
    /// `[index, value]`, or empty when nothing beats the threshold.
    pub fn winner(&self) -> Vec<f64> {
        self.0
            .winner()
            .map_or(Vec::new(), |(i, v)| vec![i as f64, v])
    }
    /// `[x, y, value, px, py, pz, object]` (object -1 for the ground), or empty.
    pub fn shift(
        &mut self,
        now: f64,
        camera: &[f64],
        objects: &[f64],
        arousal: f64,
    ) -> Result<Vec<f64>, JsError> {
        let c = cam(camera)?;
        Ok(self
            .0
            .shift(now, &c, &points(objects), arousal)
            .map_or(Vec::new(), |f| {
                vec![
                    f.x as f64,
                    f.y as f64,
                    f.value,
                    f.point.x,
                    f.point.y,
                    f.point.z,
                    f.object.map_or(-1.0, |k| k as f64),
                ]
            }))
    }
}

#[wasm_bindgen]
pub struct Loom(Looming);

#[wasm_bindgen]
impl Loom {
    #[wasm_bindgen(constructor)]
    pub fn new(tau: f64, min_angle: f64, max_gap: f64, refractory: f64) -> Loom {
        Loom(Looming::new(LoomConfig {
            tau,
            min_angle,
            max_gap,
            refractory,
        }))
    }
    /// The tau of a startle, or NaN.
    pub fn observe(&mut self, id: usize, size: f64, dist: f64, now: f64) -> f64 {
        self.0.observe(id, size, dist, now).unwrap_or(f64::NAN)
    }
    pub fn forget(&mut self, id: usize) {
        self.0.forget(id);
    }
}

#[wasm_bindgen]
pub struct OdourField(Field);

#[wasm_bindgen]
impl OdourField {
    /// `opts`: size, cells, max puffs, puff life, bounds, puff rate, wind, meander, wind heading.
    #[wasm_bindgen(constructor)]
    pub fn new(opts: &[f64], seed: u32) -> OdourField {
        let d = OdourConfig::default();
        let o = |i: usize, v: f64| opts.get(i).copied().filter(|x| x.is_finite()).unwrap_or(v);
        OdourField(Field::new(
            OdourConfig {
                size: o(0, d.size),
                cells: o(1, d.cells as f64) as usize,
                max_puffs: o(2, d.max_puffs as f64) as usize,
                puff_life: o(3, d.puff_life),
                bounds: o(4, d.bounds),
                puff_rate: o(5, d.puff_rate),
                wind: o(6, d.wind),
                meander: o(7, d.meander),
                wind_heading: o(8, d.wind_heading),
            },
            seed,
        ))
    }
    #[wasm_bindgen(js_name = setWind)]
    pub fn set_wind(&mut self, speed: f64, meander: f64) {
        self.0.cfg.wind = speed;
        self.0.cfg.meander = meander;
    }
    #[wasm_bindgen(js_name = setPuffRate)]
    pub fn set_puff_rate(&mut self, rate: f64) {
        self.0.cfg.puff_rate = rate;
    }
    /// `sources`: id, x, z, strength per source.
    pub fn step(&mut self, dt: f64, sources: &[f64]) {
        let s: Vec<Source> = (0..sources.len() / 4)
            .map(|i| Source {
                id: sources[i * 4] as usize,
                x: sources[i * 4 + 1],
                z: sources[i * 4 + 2],
                strength: sources[i * 4 + 3],
            })
            .collect();
        self.0.step(dt, &s);
    }
    #[wasm_bindgen(js_name = clearPuffs)]
    pub fn clear_puffs(&mut self) {
        self.0.clear_puffs();
    }
    pub fn concentration(&self, x: f64, z: f64) -> f64 {
        self.0.concentration(x, z)
    }
    #[wasm_bindgen(js_name = puffConcentration)]
    pub fn puff_concentration(&self, x: f64, z: f64) -> f64 {
        self.0.puff_concentration(x, z)
    }
    #[wasm_bindgen(js_name = groundConcentration)]
    pub fn ground_concentration(&self, x: f64, z: f64) -> f64 {
        self.0.ground_concentration(x, z)
    }
    pub fn deposit(&mut self, x: f64, z: f64, amount: f64, now: f64) {
        self.0.deposit(x, z, amount, now);
    }
    #[wasm_bindgen(js_name = decayTrail)]
    pub fn decay_trail(&mut self, elapsed: f64, halflife: f64) {
        self.0.decay_trail(elapsed, halflife);
    }
    /// `[dx, dz]` or empty; pass NaN for no previous direction.
    #[wasm_bindgen(js_name = trailDirection)]
    pub fn trail_direction(&self, x: f64, z: f64, prev_x: f64, prev_z: f64) -> Vec<f64> {
        let prev = if prev_x.is_finite() && prev_z.is_finite() {
            Some((prev_x, prev_z))
        } else {
            None
        };
        self.0
            .trail_direction(x, z, prev)
            .map_or(Vec::new(), |d| vec![d.0, d.1])
    }
    pub fn puffs(&self) -> Vec<f64> {
        self.0.puffs()
    }
    #[wasm_bindgen(getter, js_name = puffCount)]
    pub fn puff_count(&self) -> usize {
        self.0.puff_count()
    }
    pub fn wind(&self) -> Vec<f64> {
        let w = self.0.wind();
        vec![w.0, w.1]
    }
    pub fn trail(&self) -> Vec<f32> {
        self.0.trail().to_vec()
    }
}

#[wasm_bindgen]
pub struct Sniffer(Sn);

#[wasm_bindgen]
impl Sniffer {
    #[wasm_bindgen(constructor)]
    pub fn new(sniff_hz: f64, bout_hz: f64, seed: u32) -> Sniffer {
        Sniffer(Sn::new(sniff_hz, bout_hz, seed))
    }
    pub fn tick(
        &mut self,
        field: &OdourField,
        dt: f64,
        now: f64,
        active: bool,
        nx: f64,
        nz: f64,
        sx: f64,
        sz: f64,
    ) -> bool {
        self.0.tick(&field.0, dt, now, active, (nx, nz), (sx, sz))
    }
    pub fn whiff(&self, now: f64, window: f64) -> bool {
        self.0.whiff(now, window)
    }
    /// `[left, right, mean of both, running mean, last whiff time]`
    pub fn state(&self) -> Vec<f64> {
        vec![
            self.0.left,
            self.0.right,
            self.0.conc,
            self.0.mean,
            self.0.whiff_t,
        ]
    }
    #[wasm_bindgen(js_name = setRates)]
    pub fn set_rates(&mut self, sniff_hz: f64, bout_hz: f64) {
        self.0.sniff_hz = sniff_hz;
        self.0.bout_hz = bout_hz;
    }
}

#[wasm_bindgen]
pub struct Tracker(Tr);

#[wasm_bindgen]
impl Tracker {
    #[wasm_bindgen(constructor)]
    pub fn new(seed: u32) -> Tracker {
        Tracker(Tr::new(seed))
    }
    /// `[mode, has waypoint, wx, wz, speed, stop distance, done, changed]`;
    /// mode 0 decide, 1 trail, 2 surge, 3 cast.
    pub fn step(
        &mut self,
        field: &OdourField,
        sniffer: &Sniffer,
        dt: f64,
        now: f64,
        x: f64,
        z: f64,
        heading: f64,
        arrived: bool,
    ) -> Vec<f64> {
        let s = self
            .0
            .step(&field.0, &sniffer.0, dt, now, (x, z), heading, arrived);
        let m = match s.mode {
            TrackMode::Decide => 0.0,
            TrackMode::Trail => 1.0,
            TrackMode::Surge => 2.0,
            TrackMode::Cast => 3.0,
        };
        let (h, wx, wz) = s.waypoint.map_or((0.0, 0.0, 0.0), |w| (1.0, w.0, w.1));
        vec![
            m,
            h,
            wx,
            wz,
            s.speed,
            s.stop_dist,
            f64::from(u8::from(s.done)),
            f64::from(u8::from(s.changed)),
        ]
    }
    #[wasm_bindgen(js_name = setWaypoint)]
    pub fn set_waypoint(&mut self, x: f64, z: f64) {
        self.0.set_waypoint(x, z);
    }
}

#[wasm_bindgen]
pub struct PerceptMemory {
    mem: Mem,
    rng: Mulberry32,
}

#[wasm_bindgen]
impl PerceptMemory {
    /// `opts`: half fov, range per size, motion gain, motion speed, night floor, forget after, drift.
    #[wasm_bindgen(constructor)]
    pub fn new(opts: &[f64], seed: u32) -> PerceptMemory {
        let d = VisionProfile::default();
        let o = |i: usize, v: f64| opts.get(i).copied().filter(|x| x.is_finite()).unwrap_or(v);
        let p = VisionProfile {
            half_fov: o(0, d.half_fov),
            range_per_size: o(1, d.range_per_size),
            motion_gain: o(2, d.motion_gain),
            motion_speed: o(3, d.motion_speed),
            night_floor: o(4, d.night_floor),
            forget_after: o(5, d.forget_after),
            drift: o(6, d.drift),
        };
        PerceptMemory {
            mem: Mem::new(p),
            rng: Mulberry32::new(seed),
        }
    }
    /// `eye`: x y z; `obj`: px py pz vx vy vz size occluded hidden fixed.
    /// Returns `[visible, seen (NaN if none), salience, confidence, dist, speed]`.
    pub fn sense(
        &mut self,
        id: usize,
        eye: &[f64],
        yaw: f64,
        obj: &[f64],
        light: f64,
        t: f64,
    ) -> Result<Vec<f64>, JsError> {
        if eye.len() < 3 || obj.len() < 10 {
            return Err(JsError::new("eye needs 3 numbers and obj 10"));
        }
        let s = Sighting {
            pos: Vec3::new(obj[0], obj[1], obj[2]),
            vel: Vec3::new(obj[3], obj[4], obj[5]),
            size: obj[6],
            occluded: obj[7] != 0.0,
            hidden: obj[8] != 0.0,
            fixed: obj[9] != 0.0,
        };
        let p = self.mem.sense(
            id,
            Vec3::new(eye[0], eye[1], eye[2]),
            yaw,
            &s,
            light,
            t,
            &mut self.rng,
        );
        Ok(vec![
            f64::from(u8::from(p.visible)),
            p.seen.unwrap_or(f64::NAN),
            p.salience,
            p.confidence,
            p.dist,
            p.speed,
        ])
    }
    /// `[x, y, z, confidence]` or empty.
    pub fn recall(&self, id: usize, now: f64) -> Vec<f64> {
        self.mem
            .recall(id, now)
            .map_or(Vec::new(), |(p, c)| vec![p.x, p.y, p.z, c])
    }
}

#[wasm_bindgen]
pub struct OccupancyGrid(Grid);

#[wasm_bindgen]
impl OccupancyGrid {
    /// `opts`: cells, cell size, radius, floor y, head y, max range, hits to mark, bucket.
    #[wasm_bindgen(constructor)]
    pub fn new(opts: &[f64], cx: f64, cz: f64) -> OccupancyGrid {
        let d = GridConfig::default();
        let o = |i: usize, v: f64| opts.get(i).copied().filter(|x| x.is_finite()).unwrap_or(v);
        OccupancyGrid(Grid::new(
            GridConfig {
                cells: o(0, d.cells as f64) as usize,
                cell: o(1, d.cell),
                radius: o(2, d.radius as f64) as i32,
                floor_y: o(3, d.floor_y),
                head_y: o(4, d.head_y),
                max_range: o(5, d.max_range),
                hits_to_mark: o(6, d.hits_to_mark as f64) as u8,
                bucket: o(7, d.bucket as f64) as usize,
            },
            cx,
            cz,
        ))
    }
    pub fn integrate(
        &mut self,
        camera: &[f64],
        depth: &[f32],
        width: usize,
        height: usize,
        far: f64,
        ax: f64,
        ay: f64,
        az: f64,
    ) -> Result<(), JsError> {
        if depth.len() < width * height {
            return Err(JsError::new("depth is shorter than width * height"));
        }
        let c = cam(camera)?;
        self.0
            .integrate(&c, depth, width, height, far, Vec3::new(ax, ay, az));
        Ok(())
    }
    pub fn mark(&mut self, x: f64, z: f64, obstacle: bool) {
        self.0.mark(x, z, obstacle);
    }
    #[wasm_bindgen(js_name = freeAround)]
    pub fn free_around(&mut self, x: f64, z: f64) {
        self.0.free_around(Vec3::new(x, 0.0, z));
    }
    pub fn bump(&mut self, x: f64, z: f64) {
        self.0.bump(x, z);
    }
    pub fn at(&self, x: f64, z: f64) -> u8 {
        self.0.at(x, z)
    }
    #[wasm_bindgen(js_name = canStand)]
    pub fn can_stand(&mut self, x: f64, z: f64) -> bool {
        self.0.can_stand(x, z)
    }
    /// `x z` per waypoint, or empty when no path exists.
    pub fn path(&mut self, ax: f64, az: f64, bx: f64, bz: f64) -> Vec<f64> {
        self.0
            .path(Vec3::new(ax, 0.0, az), Vec3::new(bx, 0.0, bz))
            .map_or(Vec::new(), |p| p.iter().flat_map(|q| [q.x, q.z]).collect())
    }
    /// `x z dist size` per frontier, nearest first.
    pub fn frontiers(&mut self, x: f64, z: f64) -> Vec<f64> {
        self.0
            .frontiers(Vec3::new(x, 0.0, z))
            .iter()
            .flat_map(|f| [f.pos.x, f.pos.z, f.dist, f.size as f64])
            .collect()
    }
    #[wasm_bindgen(js_name = markDead)]
    pub fn mark_dead(&mut self, x: f64, z: f64) {
        self.0.mark_dead(Vec3::new(x, 0.0, z));
    }
    /// `[free square metres, occupied cells]`
    pub fn known(&self) -> Vec<f64> {
        let (f, o) = self.0.known();
        vec![f, o as f64]
    }
    pub fn cells(&self) -> Vec<u8> {
        self.0.cells().to_vec()
    }
    #[wasm_bindgen(getter)]
    pub fn revision(&self) -> f64 {
        self.0.revision() as f64
    }
}
