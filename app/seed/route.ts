import bcrypt from "bcrypt";
import postgres from "postgres";
import { invoices, customers, revenue, users } from "../lib/placeholder-data";

// Prefer direct (non-pooled) connection when available and disable prepared statements
// to avoid PgBouncer prepared statement invalidation (ERROR 26000).
const connectionString =
    process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL!;
const sql = postgres(connectionString, { ssl: "require", prepare: false });

async function seedUsers(db: ReturnType<typeof postgres>) {
    await db`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
    await db`
    CREATE TABLE IF NOT EXISTS users (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL
    );
  `;

    const insertedUsers = await Promise.all(
        users.map(async (user) => {
            const hashedPassword = await bcrypt.hash(user.password, 10);
            return db`
        INSERT INTO users (id, name, email, password)
        VALUES (${user.id}, ${user.name}, ${user.email}, ${hashedPassword})
        ON CONFLICT (id) DO NOTHING;
      `;
        })
    );

    return insertedUsers;
}

async function seedInvoices(db: ReturnType<typeof postgres>) {
    await db`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;

    await db`
    CREATE TABLE IF NOT EXISTS invoices (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      customer_id UUID NOT NULL,
      amount INT NOT NULL,
      status VARCHAR(255) NOT NULL,
      date DATE NOT NULL
    );
  `;

    const insertedInvoices = await Promise.all(
        invoices.map(
            (invoice) => db`
        INSERT INTO invoices (customer_id, amount, status, date)
        VALUES (${invoice.customer_id}, ${invoice.amount}, ${invoice.status}, ${invoice.date})
        ON CONFLICT (id) DO NOTHING;
      `
        )
    );

    return insertedInvoices;
}

async function seedCustomers(db: ReturnType<typeof postgres>) {
    await db`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;

    await db`
    CREATE TABLE IF NOT EXISTS customers (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      image_url VARCHAR(255) NOT NULL
    );
  `;

    const insertedCustomers = await Promise.all(
        customers.map(
            (customer) => db`
        INSERT INTO customers (id, name, email, image_url)
        VALUES (${customer.id}, ${customer.name}, ${customer.email}, ${customer.image_url})
        ON CONFLICT (id) DO NOTHING;
      `
        )
    );

    return insertedCustomers;
}

async function seedRevenue(db: ReturnType<typeof postgres>) {
    await db`
    CREATE TABLE IF NOT EXISTS revenue (
      month VARCHAR(4) NOT NULL UNIQUE,
      revenue INT NOT NULL
    );
  `;

    const insertedRevenue = await Promise.all(
        revenue.map(
            (rev) => db`
        INSERT INTO revenue (month, revenue)
        VALUES (${rev.month}, ${rev.revenue})
        ON CONFLICT (month) DO NOTHING;
      `
        )
    );

    return insertedRevenue;
}

export async function GET() {
    try {
        await sql.begin(async (tx) => {
            // Run sequentially within the same transaction/connection
            await seedUsers(tx);
            await seedCustomers(tx);
            await seedInvoices(tx);
            await seedRevenue(tx);
        });

        return Response.json({ message: "Database seeded successfully" });
    } catch (error) {
        return Response.json({ error }, { status: 500 });
    }
}
