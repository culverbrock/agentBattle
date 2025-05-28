exports.up = function(knex) {
  return knex.schema.createTable('winnings', function(table) {
    table.increments('id').primary();
    table.uuid('game_id').notNullable();
    table.string('player_id').notNullable();
    table.decimal('amount', 36, 18).notNullable();
    table.string('currency').notNullable();
    table.boolean('claimed').notNullable().defaultTo(false);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('claimed_at').nullable();
    table.index(['player_id', 'claimed']);
    table.index(['game_id']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('winnings');
}; 