import { afterAll, beforeAll, expect, test } from 'vitest';
import { PostgresBread } from '../../src/breads/postgres';
import dotenv from 'dotenv';
import { incrementalNumber, randFullName, randParagraph } from '@ngneat/falso';

dotenv.config({ path: '.env.test.local' });

const schema = 'public';
const table = 'postgresbread_test';
const primaryKeyColumn = 'id';

const idFactory = incrementalNumber();

const mockData = new Array(10).fill(0).map(() => ({
  id: idFactory(),
  name: randFullName(),
  description: randParagraph(),
}));
const mockRecord1 = mockData[0];
const mockRecord2 = mockData[1];

const postgresBread = new PostgresBread({
  connectionString: process.env.TEST_POSTGRES_CONNECTION_STRING as string,
  table,
  primaryKeyColumn,
});

beforeAll(async () => {
  await postgresBread.db.schema.withSchema(schema).createTableIfNotExists(table, (table) => {
    table.increments('id');
    table.string('name');
    table.text('description');
  });

  await postgresBread.db.batchInsert(table, mockData);
});

afterAll(async () => {
  await postgresBread.db.schema.withSchema(schema).dropTableIfExists(table);
});

test('`browse`', async () => {
  const result = await postgresBread.browse();
  expect(result).toMatchObject(mockData);
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

  const remainingRecords = await postgresBread.browse();
  const remainingNames = remainingRecords.map((record) => record.name);
  expect(remainingNames.some((name) => name === mockRecordName)).toBe(false);
});
