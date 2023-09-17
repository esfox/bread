import { Knex } from 'knex';

export type Id = string | number;

export type PaginationParams = {
  page?: number;
  count: number;
};

export type FilterParams = {
  field: string;
  value: Knex.Value;
  comparison?: '=' | '>' | '>=' | '<' | '<=' | '<>';
}[];

export type SearchParams = {
  term: string;
  fields: string[];
};

export type SortingParams = {
  field: string;
  order: 'asc' | 'desc';
}[];
