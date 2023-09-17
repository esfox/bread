import { afterAll, beforeAll, expect, test } from 'vitest';
import dotenv from 'dotenv';
import { randFullName, randParagraph } from '@ngneat/falso';
import knex from 'knex';
import { SqlBread } from '../../src/breads/sql';
import { mkdirSync, rmSync } from 'fs';
import { mockData, mockId, mockRecord1, mockRecord2 } from './mock';

dotenv.config({ path: '.env.test.local' });

const tmpDir = '.tmp';
const table = 'sqlbread_test';
const primaryKeyColumn = 'id';
const connection = knex({
  client: 'better-sqlite3',
  connection: {
    filename: process.env.TEST_SQLITE_FILENAME as string,
  },
  useNullAsDefault: true,
});

const sqlBread = new SqlBread({
  connection,
  table,
  primaryKeyColumn,
});

beforeAll(async () => {
  try {
    mkdirSync(tmpDir);
  } catch (error) {}

  const tableExists = await connection.schema.hasTable(table);
  if (!tableExists) {
    await connection.schema.createTable(table, (table) => {
      table.increments('id');
      table.string('name');
      table.text('description');
      table.enum('direction', ['left', 'right']);
    });
  }

  await connection.batchInsert(table, mockData);
});

afterAll(async () => {
  await connection.schema.dropTableIfExists(table);

  try {
    rmSync(tmpDir, { recursive: true, force: true });
  } catch (error) {}
});

test('`browse`', async () => {
  const { records } = await sqlBread.browse();
  expect(records).toMatchObject(mockData);
});

test('`browse` pagination', async () => {
  const page = 2;
  let count = 5;
  const result1 = await sqlBread.browse({
    pagination: { page, count },
  });
  expect(result1.records).toMatchObject(mockData.slice(count, 10));
  expect(result1.totalRecords).toBe(mockData.length);

  count = 8;
  const result2 = await sqlBread.browse({
    pagination: { page, count },
  });
  expect(result2.records).toMatchObject(mockData.slice(count, mockData.length));
  expect(result2.totalRecords).toBe(mockData.length);
});

test('`browse` filters with single value', async () => {
  const direction = 'left';
  const leftMockRecords = mockData.filter((mockRecord) => mockRecord.direction === direction);
  const { records } = await sqlBread.browse({
    filters: [
      {
        field: 'direction',
        value: direction,
      },
    ],
  });
  expect(records).toMatchObject(leftMockRecords);
  expect(records.every((record) => record.direction === direction)).toBe(true);
});

test('`browse` filters with array values', async () => {
  const namesToFind = mockData.slice(0, 3).map((mockRecord) => mockRecord.name);

  const { records } = await sqlBread.browse({
    filters: [
      {
        field: 'name',
        value: namesToFind,
      },
    ],
  });
  expect(records).toMatchObject(mockData.slice(0, 3));
});

test('`browse` search', async () => {
  const searchTerm = 'foobar';
  const result1 = await sqlBread.browse({
    search: {
      term: searchTerm,
      fields: ['name', 'description'],
    },
  });

  const withQuery = mockData.filter(
    (record) => record.name.includes(searchTerm) || record.description.includes(searchTerm),
  );
  expect(result1.records).toMatchObject(withQuery);

  const result2 = await sqlBread.browse({
    search: {
      term: searchTerm,
      fields: ['description'],
    },
  });

  const withQueryInDescription = mockData.filter((record) =>
    record.description.includes(searchTerm),
  );
  expect(result2.records).toMatchObject(withQueryInDescription);
});

test('`browse` sorting', async () => {
  const { records } = await sqlBread.browse({
    sorting: [
      {
        field: 'id',
        order: 'desc',
      },
    ],
  });
  const reversedMockData = mockData.reverse();
  expect(records).toMatchObject(reversedMockData);
});

test('`browse` filters, search, sorting and pagination', async () => {
  const searchTerm = 'foobar';
  const { records } = await sqlBread.browse({
    filters: [
      {
        field: 'direction',
        value: 'left',
      },
    ],
    search: {
      term: searchTerm,
      fields: ['name', 'description'],
    },
    sorting: [
      {
        field: 'id',
        order: 'desc',
      },
    ],
    pagination: {
      page: 2,
      count: 1,
    },
  });

  const expectedRecord = mockData
    .filter(
      (record) =>
        record.direction === 'left' &&
        (record.name.includes(searchTerm) || record.description.includes(searchTerm)),
    )
    .sort((a, b) => b.id - a.id)[1];
  expect(records[0]).toMatchObject(expectedRecord);
});

test('`read`', async () => {
  const result = await sqlBread.read({ id: mockRecord1.id });
  expect(result.id).toBe(mockRecord1.id);
});

test('`edit`', async () => {
  const updateData = {
    name: randFullName(),
    description: randParagraph(),
  };

  const result = await sqlBread.edit({ id: mockRecord1.id, updateData });
  expect(result).toMatchObject({ id: mockRecord1.id, ...updateData });
});

test('`add`', async () => {
  const newData = {
    id: mockId(),
    name: randFullName(),
    description: randParagraph(),
  };

  const result = await sqlBread.add({ data: newData });
  expect(result).toMatchObject(newData);
});

test('`delete`', async () => {
  const mockRecordName = mockRecord2.name;
  const deletedCount = await sqlBread.delete({ id: mockRecord2.id });
  expect(deletedCount).toBe(1);

  const { records } = await sqlBread.browse();
  const remainingNames = records.map((record) => record.name);
  expect(remainingNames.some((name) => name === mockRecordName)).toBe(false);
});
