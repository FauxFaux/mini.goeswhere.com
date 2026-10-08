/**
 * Adapted from d3-geo-projection, revision 39b53021abbfd530ab9da86f98d634cede88cae4:
 * src/{homolosine,mollweide,sinusoidal,sinuMollweide,math}.js
 * https://github.com/d3/d3-geo-projection/tree/39b53021abbfd530ab9da86f98d634cede88cae4
 * Copyright 2013-2021 Mike Bostock. ISC license: see projection-license.txt.
 * Only the raw homolosine math is retained; no D3 streaming or rendering API.
 */

const transitionLatitude = 0.7109889596207567;
const mollweideOffset = 0.0528035274542;
const mollweideXScale = (2 * Math.SQRT2) / Math.PI;
export const poleY = Math.SQRT2 - mollweideOffset;

function asin(value: number): number {
  return Math.asin(Math.max(-1, Math.min(1, value)));
}

function mollweideTheta(latitude: number): number {
  // At the poles Newton's denominator tends to zero; use the exact limit.
  if (Math.abs(latitude) === Math.PI / 2) return latitude;
  const target = Math.PI * Math.sin(latitude);
  let phi = latitude;
  for (let i = 0; i < 30; i++) {
    const delta = (phi + Math.sin(phi) - target) / (1 + Math.cos(phi));
    phi -= delta;
    if (Math.abs(delta) <= 1e-6) break;
  }
  return phi / 2;
}

/** Longitude relative to a lobe's central meridian, and latitude, in radians. */
export function homolosineForward(longitude: number, latitude: number): [number, number] {
  if (Math.abs(latitude) <= transitionLatitude) {
    return [longitude * Math.cos(latitude), latitude];
  }
  const theta = mollweideTheta(latitude);
  return [
    mollweideXScale * longitude * Math.cos(theta),
    Math.SQRT2 * Math.sin(theta) - Math.sign(latitude) * mollweideOffset,
  ];
}

export function homolosineInverse(x: number, y: number): [number, number] {
  if (Math.abs(y) <= transitionLatitude) return [x / Math.cos(y), y];
  const theta = asin((y + Math.sign(y) * mollweideOffset) / Math.SQRT2);
  return [
    x / (mollweideXScale * Math.cos(theta)),
    asin((2 * theta + Math.sin(2 * theta)) / Math.PI),
  ];
}
