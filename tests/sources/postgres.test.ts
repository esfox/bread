import { afterAll, beforeAll, expect, test } from 'vitest';
import dotenv from 'dotenv';
import knex from 'knex';
import { PostgresSource } from '../../src/sources/postgres';
import { mkdirSync } from 'fs';
import { createNewMockRecord, mockData, mockId, mockRecord2 } from './mock';

dotenv.config({ path: '.env.test.local' });

try {
  mkdirSync('.tmp');
} catch (error) {}

const primaryKeyColumn = 'id';
const connectionString = process.env.TEST_POSTGRES_CONNECTION_STRING as string;
const connection = knex({
  client: 'pg',
  connection: connectionString,
  pool: { max: 2 },
});

const table = 'postgressource_test';
const postgresSource = new PostgresSource({
  connectionString: connectionString,
  table,
  primaryKeyColumn,
});

const table2 = 'postgressource_test2';
const postgresSource2 = new PostgresSource({
  connectionString: connectionString,
  table: table2,
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

  const table2Exists = await connection.schema.withSchema('public').hasTable(table2);
  if (!table2Exists) {
    await connection.schema.withSchema('public').createTable(table2, (table) => {
      table.increments('id');
      table.integer('postgressource_test_id');
    });
  }

  await connection.batchInsert(table, mockData);
});

afterAll(async () => {
  await connection.schema.withSchema('public').dropTableIfExists(table);
  await connection.schema.withSchema('public').dropTableIfExists(table2);
});

test('`browse` case-insensitive search', async () => {
  const searchTerm = 'fOoBaR';
  const result1 = await postgresSource.browse({
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

  const result2 = await postgresSource.browse({
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
  const deletedRecord = await postgresSource.delete({ id: mockRecord2.id });
  expect(deletedRecord).toMatchObject(mockRecord2);

  const { records } = await postgresSource.browse();
  const remainingNames = records.map((record) => record.name);
  expect(remainingNames.some((name) => name === mockRecordName)).toBe(false);
});

test('Query with transaction', async () => {
  const newMockData = createNewMockRecord();
  const transaction = await postgresSource.startTransaction();
  const insertResult = await postgresSource.inTransaction(transaction).add({ data: newMockData });

  const table2Record = { postgressource_test_id: insertResult.id };
  const insertResult2 = await postgresSource2
    .inTransaction(transaction)
    .add({ data: table2Record });

  transaction.end();

  expect(insertResult2.postgressource_test_id).toBe(insertResult.id);

  const { records: records1 } = await postgresSource.browse();
  const { records: records2 } = await postgresSource2.browse();
  const newRecord = records1.find((record) => record.id === insertResult.id);
  const newRecord2 = records2.find((record) => record.postgressource_test_id === newRecord.id);
  expect(newRecord2).not.toBeUndefined();
});
