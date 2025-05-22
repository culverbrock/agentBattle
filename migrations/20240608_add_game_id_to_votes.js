exports.up = function(knex) {
  return knex.schema.table('votes', function(table) {
    table.uuid('game_id').nullable();
    table.foreign('game_id').references('games.id').onDelete('CASCADE');
  });
};

exports.down = function(knex) {
  return knex.schema.table('votes', function(table) {
    table.dropForeign('game_id');
    table.dropColumn('game_id');
  });
}; 