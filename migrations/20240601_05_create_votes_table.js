exports.up = function(knex) {
  return knex.schema.createTable('votes', function(table) {
    table.increments('id').primary();
    table.integer('proposal_id').unsigned().notNullable();
    table.string('player_id').notNullable();
    table.string('vote_value').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.foreign('proposal_id').references('proposals.id').onDelete('CASCADE');
    table.foreign('player_id').references('players.id').onDelete('CASCADE');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('votes');
}; 