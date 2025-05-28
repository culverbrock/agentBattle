exports.up = function(knex) {
  return knex.schema.createTable('payments', function(table) {
    table.increments('id').primary();
    table.uuid('game_id').notNullable();
    table.string('player_id').notNullable();
    table.decimal('amount', 36, 18).notNullable();
    table.string('currency').notNullable(); // 'ABT' or 'SPL'
    table.string('tx_hash').notNullable();
    table.string('chain').notNullable(); // 'eth' or 'sol'
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.index(['game_id']);
    table.index(['player_id']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('payments');
}; 