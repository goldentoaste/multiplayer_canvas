 function pointDistanceToLineSegment(l1, l2, p) {
    // calculate distance via area of the triangle formed by the 2 points, then divide by base to get height, which distance from point to line
    // https://en.wikipedia.org/wiki/Distance_from_a_point_to_a_line
    const x0 = p.x, y0 = p.y;
    const x1 = l1.x, y1 = l1.y;
    const x2 = l2.x, y2 = l2.y;

    const area2 = Math.abs(
        ((y2 - y1) * x0) - ((x2 - x1) * y0) + x2 * y1 - y2 * x1
    );

    const base = l2.distTo(l1);

    return area2 / base;
}

