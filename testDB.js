import pkg from "@prisma/client";
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

async function test() {
  const user = await prisma.user.create({
    data: {
      email: "test@test.com",
      password: "test123",
    },
  });

  console.log("Created user:", user);

  const found = await prisma.user.findUnique({
    where: { email: "test@test.com" },
  });

  console.log("Found user:", found);
}

test()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
