import { Knex } from 'knex';

export class Transaction {
  private instance?: Knex.Transaction;

  async start(connection: Knex) {
    this.instance = await connection.transaction();
    return this;
  }

  query(table: string) {
    if (!this.instance) {
      return;
    }

    return this.instance(table);
  }

  end(toRollback?: boolean) {
    if (!this.instance) {
      return;
    }

    if (toRollback) {
      this.instance.rollback();
    } else {
      this.instance.commit();
    }

    this.instance = undefined;
  }
}
