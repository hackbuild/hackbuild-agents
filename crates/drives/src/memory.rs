//! A memory stream ranked by recency, importance and relevance (Park et
//! al. 2023), with an importance budget that says when to reflect. Written
//! for this library from the legacy `brain.remember` and the retrieval in
//! `think`.

#[derive(Clone, Debug)]
pub struct Memory {
    pub text: String,
    pub importance: f64,
    /// game hours since the start (day * 24 + hour)
    pub hour: f64,
}

pub struct MemoryStream {
    items: Vec<Memory>,
    pub capacity: usize,
    /// recency decay per game hour (legacy 0.995)
    pub decay: f64,
    /// summed importance since the last reflection
    pub pending_importance: f64,
}

impl MemoryStream {
    pub fn new(capacity: usize) -> MemoryStream {
        MemoryStream {
            items: Vec::new(),
            capacity,
            decay: 0.995,
            pending_importance: 0.0,
        }
    }
    pub fn len(&self) -> usize {
        self.items.len()
    }
    pub fn is_empty(&self) -> bool {
        self.items.is_empty()
    }
    /// Newest first.
    pub fn items(&self) -> &[Memory] {
        &self.items
    }
    pub fn add(&mut self, text: &str, importance: f64, hour: f64) {
        self.items.insert(
            0,
            Memory {
                text: text.to_string(),
                importance,
                hour,
            },
        );
        self.items.truncate(self.capacity);
        self.pending_importance += importance;
    }
    /// Score: decay^(hours ago) + importance / 6 + 0.5 when any cue is in the text.
    pub fn score(&self, m: &Memory, hour: f64, cues: &[&str]) -> f64 {
        libm::pow(self.decay, hour - m.hour)
            + m.importance / 6.0
            + if cues.iter().any(|c| !c.is_empty() && m.text.contains(c)) {
                0.5
            } else {
                0.0
            }
    }
    /// The `k` best memories, highest score first; ties keep the newer.
    pub fn retrieve(&self, hour: f64, cues: &[&str], k: usize) -> Vec<&Memory> {
        let mut s: Vec<(f64, usize)> = self
            .items
            .iter()
            .enumerate()
            .map(|(i, m)| (self.score(m, hour, cues), i))
            .collect();
        s.sort_by(|a, b| {
            b.0.partial_cmp(&a.0)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then(a.1.cmp(&b.1))
        });
        s.into_iter().take(k).map(|(_, i)| &self.items[i]).collect()
    }
    /// True once summed importance reaches `budget`; resets the sum.
    pub fn should_reflect(&mut self, budget: f64) -> bool {
        if self.pending_importance >= budget {
            self.pending_importance = 0.0;
            true
        } else {
            false
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ranks_by_recency_importance_and_relevance() {
        let mut m = MemoryStream::new(60);
        m.add("saw a squirrel", 1.0, 0.0);
        m.add("got a treat", 3.0, 10.0);
        m.add("my human came home", 6.0, 20.0);
        m.add("sniffed the fence", 0.5, 30.0);
        let r = m.retrieve(30.0, &["squirrel"], 2);
        assert_eq!(r[0].text, "my human came home");
        assert_eq!(r[1].text, "saw a squirrel");
        assert!(m.should_reflect(10.0));
        assert!(!m.should_reflect(10.0));
        for k in 0..100 {
            m.add("x", 0.1, k as f64);
        }
        assert_eq!(m.len(), 60);
    }
}
