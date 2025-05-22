exports.up = function(knex) {
  return knex.schema.createTable('proposals', function(table) {
    table.increments('id').primary();
    table.string('player_id').notNullable();
    table.text('content').notNullable();
    table.enu('status', ['pending', 'accepted', 'rejected']).defaultTo('pending');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('proposals');
}; 