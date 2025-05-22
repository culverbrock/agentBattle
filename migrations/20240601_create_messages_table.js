exports.up = function(knex) {
  return knex.schema.createTable('messages', function(table) {
    table.increments('id').primary();
    table.uuid('game_id').notNullable();
    table.string('player_id').nullable();
    table.text('content').notNullable();
    table.string('type').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.foreign('game_id').references('games.id').onDelete('CASCADE');
    table.foreign('player_id').references('players.id').onDelete('SET NULL');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('messages');
}; 