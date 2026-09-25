import { options as baselineOptions, setup, default as baseline } from './baseline.js';

export { setup };
export const options = { ...baselineOptions, vus: 1, duration: '1m', stages: undefined };
export default baseline;
