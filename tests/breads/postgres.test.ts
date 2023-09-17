import { afterAll, beforeAll, expect, test } from 'vitest';
import dotenv from 'dotenv';
import knex from 'knex';
import { PostgresBread } from '../../src/breads/postgres';
import { mkdirSync } from 'fs';
import { mockData, mockRecord2 } from './mock';

dotenv.config({ path: '.env.test.local' });

try {
  mkdirSync('.tmp');
} catch (error) {}

const table = 'postgresbread_test';
const primaryKeyColumn = 'id';
const connectionString = process.env.TEST_POSTGRES_CONNECTION_STRING as string;
const connection = knex({
  client: 'pg',
  connection: connectionString,
  pool: { max: 2 },
});

const postgresBread = new PostgresBread({
  connectionString: connectionString,
  table,
  primaryKeyColumn,
});

beforeAll(async () => {
  const tableExists = await connection.schema.withSchema('public').hasTable(table);
  if (!tableExists) {
    await connection.schema.withSchema('public').createTable(table, (table) => {
      table.increments('id');
      table.string('name');
      table.text('description');
      table.enum('direction', ['left', 'right']);
    });
  }

  await connection.batchInsert(table, mockData);
});

afterAll(async () => {
  await connection.schema.withSchema('public').dropTableIfExists(table);
});

test('`browse` case-insensitive search', async () => {
  const searchTerm = 'fOoBaR';
  const result1 = await postgresBread.browse({
    search: {
      term: searchTerm,
      fields: ['name', 'description'],
    },
  });

  const withQuery = mockData.filter(
    (record) =>
      record.name.includes(searchTerm.toLowerCase()) ||
      record.description.includes(searchTerm.toLowerCase()),
  );
  expect(result1.records).toMatchObject(withQuery);

  const result2 = await postgresBread.browse({
    search: {
      term: searchTerm,
      fields: ['description'],
    },
  });

  const withQueryInDescription = mockData.filter((record) =>
    record.description.includes(searchTerm.toLowerCase()),
  );
  expect(result2.records).toMatchObject(withQueryInDescription);
});

test('`delete` with returned deleted record', async () => {
  const mockRecordName = mockRecord2.name;
  const deletedRecord = await postgresBread.delete({ id: mockRecord2.id });
  expect(deletedRecord).toMatchObject(mockRecord2);

  const { records } = await postgresBread.browse();
  const remainingNames = records.map((record) => record.name);
  expect(remainingNames.some((name) => name === mockRecordName)).toBe(false);
});
