import formatSelectList from './formatSelectList';

describe('formatSelectList', () => {
  it('lists every column explicitly and quotes identifiers that need it', () => {
    expect(
      formatSelectList([
        { name: 'id', isSpatial: false },
        { name: 'Full Name', isSpatial: false },
      ]),
    ).toBe('id, "Full Name"');
  });

  it('reads spatial columns as GeoJSON in place', () => {
    const sql = formatSelectList([
      { name: 'id', isSpatial: false },
      { name: 'location', isSpatial: true },
      { name: 'name', isSpatial: false },
    ]);

    expect(sql).toMatch(/^id, CASE WHEN ST_GeometryType\(location::geometry\)/);
    expect(sql).toContain(
      'ELSE ST_AsGeoJSON(location, 15, 4)::json END AS location, name',
    );
  });

  it('falls back to every column without column metadata', () => {
    expect(formatSelectList([])).toBe('*');
  });
});
