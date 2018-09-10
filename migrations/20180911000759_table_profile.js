
exports.up = function(knex, Promise) {
  return knex.schema.createTable('profile', table => {
    table.string('email').primary();
    table.datetime("lastEmailTime");
    table.integer('failedAuths').defaultTo(0).notNullable();
    table.boolean('blocked').defaultTo(0).notNullable();
  });
};

exports.down = function(knex, Promise) {
  return knex.schema.dropTable('profile');
};
