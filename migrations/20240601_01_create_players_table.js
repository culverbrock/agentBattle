exports.up = function(knex) {
  return knex.schema.createTable('players', function(table) {
    table.string('id').primary();
    table.string('name').notNullable();
    table.enu('status', ['connected', 'disconnected']).defaultTo('connected');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('players');
}; 