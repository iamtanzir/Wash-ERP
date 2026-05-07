import knex from "knex";
import path from "path";

async function test() {
  const db = knex({
    client: 'better-sqlite3',
    connection: {
      filename: path.resolve(process.cwd(), "erp_database.sqlite")
    },
    useNullAsDefault: true
  });

  try {
    console.log("Checking users table...");
    const hasUsers = await db.schema.hasTable('users');
    console.log("Has users table?", hasUsers);

    if (!hasUsers) {
      console.log("Creating users table...");
      await db.schema.createTable('users', (table) => {
        table.string('id').primary();
        table.string('username').unique();
        table.string('password_hash');
        table.string('role');
        table.string('status');
        table.timestamp('created_at').defaultTo(db.fn.now());
        table.timestamp('updated_at').defaultTo(db.fn.now());
      });
      console.log("Created successfully.");
    }
  } catch (e) {
    console.error("FAIL:", e.message);
  } finally {
    await db.destroy();
  }
}

test();
