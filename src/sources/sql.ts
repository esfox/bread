import { Transaction } from './utils/transaction';

import { Knex } from 'knex';

import { FilterParams, Id, PaginationParams, SearchParams, SortingParams } from '@/types';

export class SqlSource {
  protected connection: Knex;

  protected table: string;

  protected primaryKeyColumn: string;

  private transaction?: Transaction;

  constructor({
    connection,
    table,
    primaryKeyColumn,
  }: {
    connection: Knex;
    table: string;
    primaryKeyColumn: string;
  }) {
    this.connection = connection;
    this.table = table;
    this.primaryKeyColumn = primaryKeyColumn;
  }

  protected query() {
    let query;
    if (this.transaction) {
      query = this.transaction.query(this.table);
    }

    if (!query) {
      query = this.connection(this.table);
    }

    return query;
  }

  protected withPagination(query: Knex.QueryBuilder, pagination: PaginationParams) {
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

  protected withFilters(query: Knex.QueryBuilder, filters: FilterParams) {
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

  protected withSearch(query: Knex.QueryBuilder, searchParams: SearchParams) {
    const { term, fields } = searchParams;
    return query.where((queryBuilder) => {
      for (const field of fields) {
        queryBuilder.orWhereLike(field, `%${term}%`);
      }
    });
  }

  protected withSorting(query: Knex.QueryBuilder, sorting: SortingParams) {
    const orderByParams = sorting.map((sort) => ({
      column: sort.field,
      order: sort.order,
    }));

    return query.orderBy(orderByParams);
  }

  async startTransaction() {
    const transaction = new Transaction();
    return transaction.start(this.connection);
  }

  inTransaction(transaction: Transaction) {
    this.transaction = transaction;
    return this;
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

    this.endQuery();

    const returnValue = { records, totalRecords };
    return returnValue;
  }

  async read({ id, notFoundReturn }: { id: Id; notFoundReturn?: () => unknown }) {
    const record = await this.query().where(this.primaryKeyColumn, id).limit(1).first();

    this.endQuery();

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

    this.endQuery();

    if (!record && notFoundReturn) {
      return notFoundReturn();
    }

    return record[0];
  }

  async add({ data }: { data: Record<string, Knex.Value> }) {
    const result = await this.query().insert(data).returning('*');
    this.endQuery();
    return result[0];
  }

  async delete({ id, notFoundReturn }: { id: Id; notFoundReturn?: () => unknown }) {
    const deletedCount = await this.query().delete().where(this.primaryKeyColumn, id);
    this.endQuery();

    if (deletedCount <= 0 && notFoundReturn) {
      return notFoundReturn();
    }

    return deletedCount;
  }

  private endQuery() {
    if (this.transaction) {
      this.transaction = undefined;
    }
  }
}
