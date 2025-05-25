exports.up = function(knex) {
  return knex.schema.createTable('game_states', function(table) {
    table.uuid('game_id').primary();
    table.jsonb('state').notNullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('game_states');
}; 