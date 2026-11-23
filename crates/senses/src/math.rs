//! Vectors and a pinhole camera with the three.js conventions: the camera
//! looks down its local -Z, normalized device coordinates run -1 to 1, and
//! a point behind the camera or past the far plane projects to z above 1.

#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct Vec3 {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

#[allow(clippy::should_implement_trait)]
impl Vec3 {
    pub const fn new(x: f64, y: f64, z: f64) -> Self {
        Vec3 { x, y, z }
    }
    pub fn add(self, o: Vec3) -> Vec3 {
        Vec3::new(self.x + o.x, self.y + o.y, self.z + o.z)
    }
    pub fn sub(self, o: Vec3) -> Vec3 {
        Vec3::new(self.x - o.x, self.y - o.y, self.z - o.z)
    }
    pub fn scale(self, k: f64) -> Vec3 {
        Vec3::new(self.x * k, self.y * k, self.z * k)
    }
    pub fn dot(self, o: Vec3) -> f64 {
        self.x * o.x + self.y * o.y + self.z * o.z
    }
    pub fn cross(self, o: Vec3) -> Vec3 {
        Vec3::new(
            self.y * o.z - self.z * o.y,
            self.z * o.x - self.x * o.z,
            self.x * o.y - self.y * o.x,
        )
    }
    pub fn length(self) -> f64 {
        libm::sqrt(self.dot(self))
    }
    pub fn normalize(self) -> Vec3 {
        let l = self.length();
        if l > 0.0 { self.scale(1.0 / l) } else { self }
    }
}

/// A perspective camera: position, an orthonormal basis (right, up, back,
/// the columns of three's `matrixWorld`), vertical field of view in
/// degrees, aspect, near and far.
#[derive(Clone, Copy, Debug)]
pub struct Camera {
    pub pos: Vec3,
    pub right: Vec3,
    pub up: Vec3,
    pub back: Vec3,
    pub fov_y: f64,
    pub aspect: f64,
    pub near: f64,
    pub far: f64,
}

impl Camera {
    /// A camera at `pos` looking along yaw (0 is +Z, positive turns toward
    /// +X) and pitch (positive up), the way three's `lookAt` builds it.
    pub fn look(
        pos: Vec3,
        yaw: f64,
        pitch: f64,
        fov_y: f64,
        aspect: f64,
        near: f64,
        far: f64,
    ) -> Camera {
        let cp = libm::cos(pitch);
        let fwd = Vec3::new(libm::sin(yaw) * cp, libm::sin(pitch), libm::cos(yaw) * cp);
        Camera::looking(pos, fwd, fov_y, aspect, near, far)
    }
    /// A camera looking along `fwd` with world up +Y.
    pub fn looking(pos: Vec3, fwd: Vec3, fov_y: f64, aspect: f64, near: f64, far: f64) -> Camera {
        let back = fwd.scale(-1.0).normalize();
        let mut right = Vec3::new(0.0, 1.0, 0.0).cross(back);
        if right.length() < 1e-9 {
            right = Vec3::new(1.0, 0.0, 0.0);
        }
        let right = right.normalize();
        let up = back.cross(right);
        Camera {
            pos,
            right,
            up,
            back,
            fov_y,
            aspect,
            near,
            far,
        }
    }
    fn tan_half(&self) -> f64 {
        libm::tan(self.fov_y.to_radians() / 2.0)
    }
    /// World point to normalized device coordinates.
    pub fn project(&self, p: Vec3) -> Vec3 {
        let d = p.sub(self.pos);
        let vx = d.dot(self.right);
        let vy = d.dot(self.up);
        let vz = d.dot(self.back);
        let f = 1.0 / self.tan_half();
        let w = -vz;
        let (n, fa) = (self.near, self.far);
        let zc = -(fa + n) / (fa - n) * vz - 2.0 * fa * n / (fa - n);
        Vec3::new(vx * f / self.aspect / w, vy * f / w, zc / w)
    }
    /// The unit world direction through a point in normalized device coordinates.
    pub fn ray(&self, ndc_x: f64, ndc_y: f64) -> Vec3 {
        let t = self.tan_half();
        let v = self
            .right
            .scale(ndc_x * t * self.aspect)
            .add(self.up.scale(ndc_y * t))
            .sub(self.back);
        v.normalize()
    }
}

/// Angle wrapped into `(-pi, pi]`.
pub fn wrap_angle(a: f64) -> f64 {
    let tau = core::f64::consts::TAU;
    let mut x = a % tau;
    if x > core::f64::consts::PI {
        x -= tau;
    } else if x <= -core::f64::consts::PI {
        x += tau;
    }
    x
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn project_and_ray_agree() {
        let c = Camera::look(Vec3::new(1.0, 0.5, -2.0), 0.4, -0.2, 74.0, 2.0, 0.05, 50.0);
        let p = c.pos.add(c.ray(0.3, -0.4).scale(3.0));
        let q = c.project(p);
        assert!((q.x - 0.3).abs() < 1e-12 && (q.y + 0.4).abs() < 1e-12);
        assert!(q.z < 1.0);
        let behind = c.pos.sub(c.ray(0.0, 0.0));
        assert!(c.project(behind).z > 1.0);
    }

    #[test]
    fn wraps() {
        assert!((wrap_angle(3.5) - (3.5 - core::f64::consts::TAU)).abs() < 1e-12);
        assert!((wrap_angle(-3.5) - (-3.5 + core::f64::consts::TAU)).abs() < 1e-12);
    }
}
