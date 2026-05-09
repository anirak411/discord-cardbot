import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const cards = [
  ["Taeyeon", "Girls' Generation", "INVU", "LEGENDARY", "https://picsum.photos/seed/taeyeon/400/600"],
  ["Karina", "aespa", "Drama", "EPIC", "https://picsum.photos/seed/karina/400/600"],
  ["Wonyoung", "IVE", "I AM", "RARE", "https://picsum.photos/seed/wonyoung/400/600"],
  ["Sakura", "LE SSERAFIM", "UNFORGIVEN", "RARE", "https://picsum.photos/seed/sakura/400/600"],
  ["Jungkook", "BTS", "GOLDEN", "EPIC", "https://picsum.photos/seed/jungkook/400/600"],
  ["Mingyu", "SEVENTEEN", "FML", "COMMON", "https://picsum.photos/seed/mingyu/400/600"],
  ["Ningning", "aespa", "Savage", "COMMON", "https://picsum.photos/seed/ningning/400/600"],
  ["Chaewon", "LE SSERAFIM", "ANTIFRAGILE", "COMMON", "https://picsum.photos/seed/chaewon/400/600"],
  ["Felix", "Stray Kids", "5-STAR", "RARE", "https://picsum.photos/seed/felix/400/600"],
  ["IU", "Solo", "LILAC", "MYTHIC", "https://picsum.photos/seed/iu/400/600"]
];

async function main() {
  const count = await prisma.card.count();
  if (count > 0) {
    console.log("Cards already seeded.");
    return;
  }

  for (const [idolName, groupName, era, rarity, imageUrl] of cards) {
    await prisma.card.create({
      data: { idolName, groupName, era, rarity, imageUrl }
    });
  }

  console.log(`Seeded ${cards.length} cards.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
