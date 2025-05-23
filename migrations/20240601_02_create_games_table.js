exports.up = function(knex) {
  return knex.schema.createTable('games', function(table) {
    table.uuid('id').primary();
    table.string('name').notNullable();
    table.enu('status', ['lobby', 'active', 'finished']).defaultTo('lobby');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('games');
}; 