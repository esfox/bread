import { afterAll, beforeAll, expect, test } from 'vitest';
import { PostgresBread } from '../../src/breads/postgres';
import dotenv from 'dotenv';
import { incrementalNumber, randFullName, randParagraph } from '@ngneat/falso';

dotenv.config({ path: '.env.test.local' });

const schema = 'public';
const table = 'postgresbread_test';
const primaryKeyColumn = 'id';

const idFactory = incrementalNumber();

const mockData = new Array(10).fill(0).map((_, i) => ({
  id: idFactory(),
  name: randFullName(),
  description: randParagraph(),
  direction: i % 2 === 0 ? 'left' : 'right',
}));

mockData.push({
  id: idFactory(),
  name: 'there is foobar in this name',
  description: randParagraph(),
  direction: 'left',
});

mockData.push({
  id: idFactory(),
  name: randFullName(),
  description: 'there is foobar in this description',
  direction: 'right',
});

const expectedMockRecord = {
  id: idFactory(),
  name: randFullName(),
  description: 'there is foobar in this description',
  direction: 'left',
};

mockData.push(expectedMockRecord);

const mockRecord1 = mockData[0];
const mockRecord2 = mockData[1];

const postgresBread = new PostgresBread({
  connectionString: process.env.TEST_POSTGRES_CONNECTION_STRING as string,
  table,
  primaryKeyColumn,
});

beforeAll(async () => {
  const tableExists = await postgresBread.db.schema.hasTable(table);
  if (!tableExists) {
    await postgresBread.db.schema.withSchema(schema).createTable(table, (table) => {
      table.increments('id');
      table.string('name');
      table.text('description');
      table.enum('direction', ['left', 'right']);
    });
  }

  await postgresBread.db.batchInsert(table, mockData);
});

afterAll(async () => {
  await postgresBread.db.schema.withSchema(schema).dropTableIfExists(table);
});

test('`browse`', async () => {
  const { records } = await postgresBread.browse();
  expect(records).toMatchObject(mockData);
});

test('`browse` pagination', async () => {
  const page = 2;
  let count = 5;
  const result1 = await postgresBread.browse({
    pagination: { page, count },
  });
  expect(result1.records).toMatchObject(mockData.slice(count, 10));
  expect(result1.totalRecords).toBe(mockData.length);

  count = 8;
  const result2 = await postgresBread.browse({
    pagination: { page, count },
  });
  expect(result2.records).toMatchObject(mockData.slice(count, mockData.length));
  expect(result2.totalRecords).toBe(mockData.length);
});

test('`browse` filters with single value', async () => {
  const direction = 'left';
  const leftMockRecords = mockData.filter((mockRecord) => mockRecord.direction === direction);
  const { records } = await postgresBread.browse({
    filters: [
      {
        column: 'direction',
        value: direction,
      },
    ],
  });
  expect(records).toMatchObject(leftMockRecords);
  expect(records.every((record) => record.direction === direction)).toBe(true);
});

test('`browse` filters with array values', async () => {
  const namesToFind = mockData.slice(0, 3).map((mockRecord) => mockRecord.name);

  const { records } = await postgresBread.browse({
    filters: [
      {
        column: 'name',
        value: namesToFind,
      },
    ],
  });
  expect(records).toMatchObject(mockData.slice(0, 3));
});

test('`browse` search', async () => {
  const query = 'foobar';
  const result1 = await postgresBread.browse({
    search: {
      query,
      fields: ['name', 'description'],
    },
  });

  const withQuery = mockData.filter(
    (record) => record.name.includes(query) || record.description.includes(query),
  );
  expect(result1.records).toMatchObject(withQuery);

  const result2 = await postgresBread.browse({
    search: {
      query,
      fields: ['description'],
    },
  });

  const withQueryInDescription = mockData.filter((record) => record.description.includes(query));
  expect(result2.records).toMatchObject(withQueryInDescription);
});

test('`browse` ordering', async () => {
  const { records } = await postgresBread.browse({
    ordering: [
      {
        column: 'id',
        order: 'desc',
      },
    ],
  });
  const reversedMockData = mockData.reverse();
  expect(records).toMatchObject(reversedMockData);
});

// TODO: Add ordering
test('`browse` filters, search and pagination', async () => {
  const { records } = await postgresBread.browse({
    filters: [
      {
        column: 'direction',
        value: 'left',
      },
    ],
    search: {
      query: 'foobar',
      fields: ['name', 'description'],
    },
    pagination: {
      page: 2,
      count: 1,
    },
  });

  expect(records[0]).toMatchObject(expectedMockRecord);
});

test('`read`', async () => {
  const result = await postgresBread.read({ id: mockRecord1.id });
  expect(result.id).toBe(mockRecord1.id);
});

test('`edit`', async () => {
  const updateData = {
    name: randFullName(),
    description: randParagraph(),
  };

  const result = await postgresBread.edit({ id: mockRecord1.id, updateData });
  expect(result).toMatchObject({ id: mockRecord1.id, ...updateData });
});

test('`add`', async () => {
  const newData = {
    id: idFactory(),
    name: randFullName(),
    description: randParagraph(),
  };

  const result = await postgresBread.add({ data: newData });
  expect(result).toMatchObject(newData);
});

test('`delete`', async () => {
  const mockRecordName = mockRecord2.name;
  const result = await postgresBread.delete({ id: mockRecord2.id });
  expect(result).toMatchObject(mockRecord2);

  const { records } = await postgresBread.browse();
  const remainingNames = records.map((record) => record.name);
  expect(remainingNames.some((name) => name === mockRecordName)).toBe(false);
});
