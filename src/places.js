// The tour: ten places in the order the map hops between them.
// 'carthage' is the Tunis stop: Carthage, Sidi Bou Said and La Marsa, neighbours in the northern suburbs.
// Coordinates are the sites themselves (not city centres). `unesco` links the
// World Heritage listing where one exists. Shared by the map and the page, no three.js here.
export const TOUR = [
  { key: 'carthage', lon: 10.3317, lat: 36.8528, h: 1.9, unesco: { year: 1979, url: 'https://whc.unesco.org/en/list/37/' } },
  { key: 'bizerte', lon: 9.8739, lat: 37.2744, h: 2.0 },
  { key: 'aindraham', lon: 8.687, lat: 36.779, h: 2.2 },
  { key: 'dougga', lon: 9.2183, lat: 36.4236, h: 2.0, unesco: { year: 1997, url: 'https://whc.unesco.org/en/list/794/' } },
  { key: 'kairouan', lon: 10.1036, lat: 35.6814, h: 2.4, unesco: { year: 1988, url: 'https://whc.unesco.org/en/list/499/' } },
  { key: 'hammamet', lon: 10.6153, lat: 36.3993, h: 2.2 },
  { key: 'eljem', lon: 10.7069, lat: 35.2964, h: 2.2, unesco: { year: 1979, url: 'https://whc.unesco.org/en/list/38/' } },
  { key: 'matmata', lon: 9.967, lat: 33.5426, h: 2.4 },
  { key: 'djerba', lon: 10.8592, lat: 33.8139, h: 2.4, unesco: { year: 2023, url: 'https://whc.unesco.org/en/list/1640/' } },
  { key: 'tozeur', lon: 8.1335, lat: 33.9197, h: 2.6 },
];

// Tunis-Carthage airport, where the flight lands.
export const TUN = { lon: 10.2272, lat: 36.851 };

// Great-circle distance in km.
export function haversineKm(a, b) {
  const R = 6371.0088;
  const r = (d) => (d * Math.PI) / 180;
  const dLat = r(b.lat - a.lat);
  const dLon = r(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
