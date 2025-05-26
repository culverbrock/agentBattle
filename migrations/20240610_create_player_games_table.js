exports.up = function(knex) {
  return knex.schema.createTable('player_games', function(table) {
    table.string('player_id').notNullable();
    table.uuid('game_id').notNullable();
    table.primary(['player_id', 'game_id']);
    table.foreign('player_id').references('players.id').onDelete('CASCADE');
    table.foreign('game_id').references('games.id').onDelete('CASCADE');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('player_games');
}; 