import knex, { Knex } from 'knex';
import pg from 'pg';

import { Id, SqlComparison } from '@/types';

pg.types.setTypeParser(pg.types.builtins.INT8, (value: string) => Number(value));
pg.types.setTypeParser(pg.types.builtins.FLOAT8, (value: string) => Number(value));
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (value: string) => Number(value));

const defaultPoolMaxCount = 10;

export class PostgresBread {
  public db: Knex;

  protected table: string;

  protected primaryKeyColumn: string;

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
    this.db = knex({
      client: 'pg',
      connection: connectionString,
      pool: { max: poolMaxCount },
    });

    this.table = table;
    this.primaryKeyColumn = primaryKeyColumn;
  }

  private withPagination(query: Knex.QueryBuilder, count: number, page?: number) {
    let newQuery = query;
    if (count) {
      newQuery = newQuery.limit(count);

      if (page) {
        newQuery = newQuery.offset(count * (page - 1));
      }
    }

    return newQuery;
  }

  private withFilters(
    query: Knex.QueryBuilder,
    filters: {
      column: string;
      value: Knex.Value;
      comparison?: SqlComparison;
    }[],
  ) {
    let newQuery = query;
    for (const filter of filters) {
      const { column, value, comparison } = filter;
      if (Array.isArray(value)) {
        newQuery = newQuery.whereIn(column, value);
      } else {
        newQuery = newQuery.where(column, comparison ?? '=', value);
      }
    }

    return newQuery;
  }

  private withSearch(query: Knex.QueryBuilder, searchQuery: string, searchFields: string[]) {
    return query.where((queryBuilder) => {
      for (const field of searchFields) {
        queryBuilder.orWhereILike(field, `%${searchQuery}%`);
      }
    });
  }

  protected query() {
    return this.db(this.table);
  }

  async browse(
    args: {
      pagination?: {
        page?: number;
        count: number;
      };
      filters?: {
        column: string;
        value: Knex.Value;
        comparison?: SqlComparison;
      }[];
      search?: {
        query: string;
        fields: string[];
      };
      ordering?: {
        column: string;
        order: 'asc' | 'desc';
      }[];
    } = {},
  ) {
    let query = this.query().select();

    const { pagination, filters, search, ordering } = args ?? {};
    if (filters) {
      query = this.withFilters(query, filters);
    }

    if (search) {
      query = this.withSearch(query, search.query, search.fields);
    }

    if (ordering) {
      query = query.orderBy(ordering);
    }

    let totalRecords;
    if (pagination) {
      query = this.withPagination(query, pagination.count, pagination.page);

      if (pagination.page) {
        const totalCountResult = await query
          .clone()
          .count(this.primaryKeyColumn, { as: 'value' })
          .offset(0)
          .limit(1)
          .first();

        if (totalCountResult) {
          totalRecords = Number(totalCountResult.value);
        }
      }
    }

    const records = await query;
    const returnValue = { records, totalRecords };
    return returnValue;
  }

  async read({ id, notFoundReturn }: { id: Id; notFoundReturn?: () => unknown }) {
    const record = await this.query().where(this.primaryKeyColumn, id).limit(1).first();
    if (!record && notFoundReturn) {
      return notFoundReturn();
    }

    return record;
  }

  async edit({
    id,
    updateData,
    notFoundReturn,
  }: {
    id: Id;
    updateData: Record<string, Knex.Value>;
    notFoundReturn?: () => unknown;
  }) {
    const record = await this.query()
      .update(updateData)
      .where(this.primaryKeyColumn, id)
      .returning('*');

    if (!record && notFoundReturn) {
      return notFoundReturn();
    }

    return record[0];
  }

  async add({ data }: { data: Record<string, Knex.Value> }) {
    const result = await this.query().insert(data).returning('*');
    return result[0];
  }

  async delete({ id, notFoundReturn }: { id: Id; notFoundReturn?: () => unknown }) {
    const record = await this.query().delete().where(this.primaryKeyColumn, id).returning('*');

    if (!record && notFoundReturn) {
      return notFoundReturn();
    }

    return record[0];
  }
}
