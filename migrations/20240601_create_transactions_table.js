exports.up = function(knex) {
  return knex.schema.createTable('transactions', function(table) {
    table.increments('id').primary();
    table.string('player_id').notNullable();
    table.uuid('game_id').notNullable();
    table.decimal('amount', 14, 2).notNullable();
    table.string('type').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.foreign('player_id').references('players.id').onDelete('CASCADE');
    table.foreign('game_id').references('games.id').onDelete('CASCADE');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('transactions');
}; 