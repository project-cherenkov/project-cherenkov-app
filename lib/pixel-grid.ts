// The one base unit of the Neutrino pixel style, in CSS pixels. The panel skin
// (`--px` in globals.css) and the trail's pixel cells both snap to it.
export const PIXEL_UNIT = 2;

export const snapToPixel = (value: number) => Math.round(value / PIXEL_UNIT) * PIXEL_UNIT;
