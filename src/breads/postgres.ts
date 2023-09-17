import knex, { Knex } from 'knex';
import pg from 'pg';

import { FilterParams, Id, PaginationParams, SearchParams, SortingParams } from '@/types';

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

  private withPagination(query: Knex.QueryBuilder, pagination: PaginationParams) {
    const { count, page } = pagination;
    let newQuery = query;
    if (count) {
      newQuery = newQuery.limit(count);

      if (page) {
        newQuery = newQuery.offset(count * (page - 1));
      }
    }

    return newQuery;
  }

  private withFilters(query: Knex.QueryBuilder, filters: FilterParams) {
    let newQuery = query;
    for (const filter of filters) {
      const { field, value, comparison } = filter;
      if (Array.isArray(value)) {
        newQuery = newQuery.whereIn(field, value);
      } else {
        newQuery = newQuery.where(field, comparison ?? '=', value);
      }
    }

    return newQuery;
  }

  private withSearch(query: Knex.QueryBuilder, searchParams: SearchParams) {
    const { term, fields } = searchParams;
    return query.where((queryBuilder) => {
      for (const field of fields) {
        queryBuilder.orWhereILike(field, `%${term}%`);
      }
    });
  }

  private withSorting(query: Knex.QueryBuilder, sorting: SortingParams) {
    const orderByParams = sorting.map((sort) => ({
      column: sort.field,
      order: sort.order,
    }));

    return query.orderBy(orderByParams);
  }

  protected query() {
    return this.db(this.table);
  }

  async browse(
    args: {
      pagination?: PaginationParams;
      filters?: FilterParams;
      search?: SearchParams;
      sorting?: SortingParams;
    } = {},
  ) {
    let query = this.query().select();

    const { pagination, filters, search, sorting } = args ?? {};
    if (filters) {
      query = this.withFilters(query, filters);
    }

    if (search) {
      query = this.withSearch(query, search);
    }

    /* The query is cloned here since the total records query should have
      filters but not sorting, since the query will not work if with sorting. */
    const queryWithFilters = query.clone();

    if (sorting) {
      query = this.withSorting(query, sorting);
    }

    let totalRecords;
    if (pagination) {
      query = this.withPagination(query, pagination);

      if (pagination.page) {
        const totalCountResult = await queryWithFilters
          .count(this.primaryKeyColumn, { as: 'value' })
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
