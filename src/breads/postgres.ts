import { SqlBread } from './sql';

import knex, { Knex } from 'knex';
import pg from 'pg';

import { Id, SearchParams } from '@/types';

pg.types.setTypeParser(pg.types.builtins.INT8, (value: string) => Number(value));
pg.types.setTypeParser(pg.types.builtins.FLOAT8, (value: string) => Number(value));
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (value: string) => Number(value));

const defaultPoolMaxCount = 10;

export class PostgresBread extends SqlBread {
  constructor({
    connectionString,
    table,
    primaryKeyColumn,
    poolMaxCount = defaultPoolMaxCount,
  }: {
    connectionString: string;
    table: string;
    primaryKeyColumn: string;
    poolMaxCount?: number;
  }) {
    super({
      connection: knex({
        client: 'pg',
        connection: connectionString,
        pool: { max: poolMaxCount },
      }),
      table,
      primaryKeyColumn,
    });
  }

  protected withSearch(query: Knex.QueryBuilder, searchParams: SearchParams) {
    const { term, fields } = searchParams;
    return query.where((queryBuilder) => {
      for (const field of fields) {
        queryBuilder.orWhereILike(field, `%${term}%`);
      }
    });
  }

  async delete({ id, notFoundReturn }: { id: Id; notFoundReturn?: () => unknown }) {
    const deletedRecord = await this.query()
      .delete()
      .where(this.primaryKeyColumn, id)
      .returning('*');

    if (deletedRecord && notFoundReturn) {
      return notFoundReturn();
    }

    return deletedRecord[0];
  }
}
