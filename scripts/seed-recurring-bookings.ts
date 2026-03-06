import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Court name → DB id mapping (verified from database)
// DB id=1 → "Court 2", id=2 → "Court 4", id=3 → "Court 3", id=4 → "Court 1"
const COURT_MAP: Record<number, number> = {
  1: 4, // Schedule "Court 1" → DB id=4
  2: 1, // Schedule "Court 2" → DB id=1
  3: 3, // Schedule "Court 3" → DB id=3
  4: 2, // Schedule "Court 4" → DB id=2
};

interface ScheduleEntry {
  day: number; // 0=Sun, 1=Mon, ..., 6=Sat
  start: string; // "HH:mm" format
  end: string; // "HH:mm" format, "24:00" for midnight
  courts: number[]; // Schedule court numbers (1-4)
  label: string;
  guestName: string;
  guestPhone?: string;
}

const schedule: ScheduleEntry[] = [
  // ===== MONDAY (1) =====
  {
    day: 1,
    start: "17:00",
    end: "19:00",
    courts: [1],
    label: "Thomas (Coaching)",
    guestName: "Thomas",
    guestPhone: "0125128508",
  },
  {
    day: 1,
    start: "19:00",
    end: "21:00",
    courts: [1, 2, 3],
    label: "Old Xaverians Association",
    guestName: "Old Xaverians Association",
  },
  {
    day: 1,
    start: "19:00",
    end: "21:00",
    courts: [4],
    label: "Seang",
    guestName: "Seang",
  },
  {
    day: 1,
    start: "21:00",
    end: "24:00",
    courts: [1, 2, 3, 4],
    label: "Zhi Chao",
    guestName: "Zhi Chao",
  },

  // ===== TUESDAY (2) =====
  {
    day: 2,
    start: "16:00",
    end: "17:30",
    courts: [1],
    label: "Thomas (Coaching)",
    guestName: "Thomas",
    guestPhone: "0125128508",
  },
  {
    day: 2,
    start: "16:00",
    end: "17:30",
    courts: [2],
    label: "Thomas (Coaching)",
    guestName: "Thomas",
    guestPhone: "0125128508",
  },
  {
    day: 2,
    start: "19:00",
    end: "21:00",
    courts: [1, 2],
    label: "Shin Leong",
    guestName: "Shin Leong",
  },
  {
    day: 2,
    start: "19:00",
    end: "21:00",
    courts: [3],
    label: "Wei Hao",
    guestName: "Wei Hao",
  },
  {
    day: 2,
    start: "19:30",
    end: "21:30",
    courts: [4],
    label: "Thomas (Coaching)",
    guestName: "Thomas",
    guestPhone: "0125128508",
  },
  {
    day: 2,
    start: "21:00",
    end: "24:00",
    courts: [1, 2],
    label: "Ah Yong",
    guestName: "Ah Yong",
  },
  {
    day: 2,
    start: "21:30",
    end: "24:00",
    courts: [3, 4],
    label: "Beng Yee",
    guestName: "Beng Yee",
  },

  // ===== WEDNESDAY (3) =====
  {
    day: 3,
    start: "17:00",
    end: "19:00",
    courts: [1],
    label: "Thomas (Coaching)",
    guestName: "Thomas",
    guestPhone: "0125128508",
  },
  {
    day: 3,
    start: "17:30",
    end: "19:30",
    courts: [2],
    label: "Thomas (Coaching)",
    guestName: "Thomas",
    guestPhone: "0125128508",
  },
  {
    day: 3,
    start: "17:30",
    end: "19:30",
    courts: [3],
    label: "Jamal",
    guestName: "Jamal",
  },
  {
    day: 3,
    start: "19:00",
    end: "21:00",
    courts: [1],
    label: "Seang",
    guestName: "Seang",
  },
  {
    day: 3,
    start: "19:30",
    end: "21:30",
    courts: [2, 3],
    label: "Chiam",
    guestName: "Chiam",
  },
  {
    day: 3,
    start: "20:00",
    end: "22:00",
    courts: [4],
    label: "Nico",
    guestName: "Nico",
  },
  {
    day: 3,
    start: "21:00",
    end: "24:00",
    courts: [1],
    label: "Joo",
    guestName: "Joo",
  },
  {
    day: 3,
    start: "21:30",
    end: "24:00",
    courts: [2, 3],
    label: "Joo",
    guestName: "Joo",
  },
  {
    day: 3,
    start: "22:00",
    end: "24:00",
    courts: [4],
    label: "Joo",
    guestName: "Joo",
  },

  // ===== THURSDAY (4) =====
  {
    day: 4,
    start: "16:00",
    end: "17:30",
    courts: [1],
    label: "Thomas (Coaching)",
    guestName: "Thomas",
    guestPhone: "0125128508",
  },
  {
    day: 4,
    start: "16:00",
    end: "17:30",
    courts: [2],
    label: "Thomas (Coaching)",
    guestName: "Thomas",
    guestPhone: "0125128508",
  },
  {
    day: 4,
    start: "17:30",
    end: "19:30",
    courts: [1],
    label: "Thomas (Coaching)",
    guestName: "Thomas",
    guestPhone: "0125128508",
  },
  {
    day: 4,
    start: "17:00",
    end: "19:00",
    courts: [4],
    label: "Pei Yin",
    guestName: "Pei Yin",
  },
  {
    day: 4,
    start: "20:00",
    end: "22:00",
    courts: [1],
    label: "Ling",
    guestName: "Ling",
  },
  {
    day: 4,
    start: "19:30",
    end: "22:00",
    courts: [4],
    label: "Thomas (Coaching)",
    guestName: "Thomas",
    guestPhone: "0125128508",
  },
  {
    day: 4,
    start: "20:00",
    end: "22:00",
    courts: [2, 3],
    label: "Thomas (Coaching)",
    guestName: "Thomas",
    guestPhone: "0125128508",
  },
  {
    day: 4,
    start: "22:00",
    end: "24:00",
    courts: [1, 2],
    label: "Alvin",
    guestName: "Alvin",
  },
  {
    day: 4,
    start: "22:00",
    end: "24:00",
    courts: [3, 4],
    label: "Ming Jun",
    guestName: "Ming Jun",
  },

  // ===== FRIDAY (5) =====
  {
    day: 5,
    start: "16:00",
    end: "17:30",
    courts: [1],
    label: "Thomas (Coaching)",
    guestName: "Thomas",
    guestPhone: "0125128508",
  },
  {
    day: 5,
    start: "17:30",
    end: "19:00",
    courts: [1],
    label: "Thomas (Coaching)",
    guestName: "Thomas",
    guestPhone: "0125128508",
  },
  {
    day: 5,
    start: "17:30",
    end: "19:30",
    courts: [2],
    label: "Thomas (Coaching)",
    guestName: "Thomas",
    guestPhone: "0125128508",
  },
  {
    day: 5,
    start: "19:00",
    end: "21:30",
    courts: [1],
    label: "Mr. Loh",
    guestName: "Mr. Loh",
  },
  {
    day: 5,
    start: "19:30",
    end: "22:00",
    courts: [2],
    label: "Mr. Loh",
    guestName: "Mr. Loh",
  },
  {
    day: 5,
    start: "19:30",
    end: "21:30",
    courts: [3],
    label: "Ghazi & Lim",
    guestName: "Ghazi & Lim",
  },
  {
    day: 5,
    start: "19:30",
    end: "21:30",
    courts: [4],
    label: "Thomas (Coaching)",
    guestName: "Thomas",
    guestPhone: "0125128508",
  },
  {
    day: 5,
    start: "21:30",
    end: "24:00",
    courts: [1],
    label: "Thomas",
    guestName: "Thomas",
    guestPhone: "0125128508",
  },
  {
    day: 5,
    start: "22:00",
    end: "24:00",
    courts: [2],
    label: "Thomas",
    guestName: "Thomas",
    guestPhone: "0125128508",
  },
  {
    day: 5,
    start: "21:30",
    end: "24:00",
    courts: [3, 4],
    label: "Wendy",
    guestName: "Wendy",
  },

  // ===== SATURDAY (6) =====
  {
    day: 6,
    start: "09:00",
    end: "11:00",
    courts: [1, 2],
    label: "Thomas (Coaching)",
    guestName: "Thomas",
    guestPhone: "0125128508",
  },
  {
    day: 6,
    start: "11:00",
    end: "13:00",
    courts: [1, 2],
    label: "Thomas (Coaching)",
    guestName: "Thomas",
    guestPhone: "0125128508",
  },
  {
    day: 6,
    start: "13:00",
    end: "15:00",
    courts: [1, 2],
    label: "Thomas (Coaching)",
    guestName: "Thomas",
    guestPhone: "0125128508",
  },
  {
    day: 6,
    start: "15:00",
    end: "17:00",
    courts: [1, 2],
    label: "Thomas (Coaching)",
    guestName: "Thomas",
    guestPhone: "0125128508",
  },
  {
    day: 6,
    start: "17:00",
    end: "19:00",
    courts: [1, 2],
    label: "Thomas (Coaching)",
    guestName: "Thomas",
    guestPhone: "0125128508",
  },
  {
    day: 6,
    start: "20:00",
    end: "23:00",
    courts: [3],
    label: "Peter",
    guestName: "Peter",
  },
  {
    day: 6,
    start: "21:00",
    end: "23:00",
    courts: [1, 2],
    label: "Peter",
    guestName: "Peter",
  },

  // ===== SUNDAY (0) =====
  {
    day: 0,
    start: "09:00",
    end: "11:00",
    courts: [1, 2],
    label: "Thomas (Coaching)",
    guestName: "Thomas",
    guestPhone: "0125128508",
  },
  {
    day: 0,
    start: "11:00",
    end: "13:00",
    courts: [1, 2],
    label: "Thomas (Coaching)",
    guestName: "Thomas",
    guestPhone: "0125128508",
  },
  {
    day: 0,
    start: "13:00",
    end: "15:00",
    courts: [1, 2],
    label: "Thomas (Coaching)",
    guestName: "Thomas",
    guestPhone: "0125128508",
  },
  {
    day: 0,
    start: "14:00",
    end: "17:00",
    courts: [3],
    label: "Seng",
    guestName: "Seng",
  },
  {
    day: 0,
    start: "16:00",
    end: "18:00",
    courts: [4],
    label: "John",
    guestName: "John",
  },
  {
    day: 0,
    start: "17:00",
    end: "19:00",
    courts: [1, 2, 3],
    label: "Thomas (Coaching)",
    guestName: "Thomas",
    guestPhone: "0125128508",
  },
  {
    day: 0,
    start: "19:00",
    end: "21:00",
    courts: [1],
    label: "Jun Xian",
    guestName: "Jun Xian",
  },
  {
    day: 0,
    start: "19:00",
    end: "21:00",
    courts: [2, 3],
    label: "Ken",
    guestName: "Ken",
  },
];

function nextSlotTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const totalMinutes = h * 60 + m + 30;
  if (totalMinutes >= 1440) return "24:00";
  return (
    String(Math.floor(totalMinutes / 60)).padStart(2, "0") +
    ":" +
    String(totalMinutes % 60).padStart(2, "0")
  );
}

function generateSlots(start: string, end: string): string[] {
  const slots: string[] = [];
  let current = start;
  while (current < end) {
    slots.push(current);
    current = nextSlotTime(current);
  }
  return slots;
}

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

interface SlotRecord {
  courtId: number;
  sport: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  startDate: Date;
  endDate: null;
  label: string;
  userId: null;
  guestName: string;
  guestPhone: string | null;
  createdBy: null;
  isActive: boolean;
}

async function main() {
  const DRY_RUN = process.argv.includes("--dry-run");

  console.log(
    DRY_RUN
      ? "\n=== DRY RUN MODE ===\n"
      : "\n=== CREATING RECURRING BOOKINGS ===\n",
  );

  // Verify no existing active recurring bookings
  const existingCount = await prisma.recurringBooking.count({
    where: { isActive: true },
  });
  if (existingCount > 0) {
    console.error(
      `ABORT: Found ${existingCount} existing active recurring bookings. This script only runs on an empty table.`,
    );
    console.error("To proceed, deactivate existing bookings first.");
    process.exit(1);
  }

  const allRecords: SlotRecord[] = [];
  const conflicts: string[] = [];
  const slotMap = new Map<string, string>(); // "courtId-day-slotTime" → label (for conflict detection)
  const startDate = new Date("2026-03-03");

  for (const entry of schedule) {
    const slots = generateSlots(entry.start, entry.end);

    for (const courtNum of entry.courts) {
      const dbCourtId = COURT_MAP[courtNum];
      if (!dbCourtId) {
        console.error(`Unknown court number: ${courtNum}`);
        process.exit(1);
      }

      for (const slotTime of slots) {
        const key = `${dbCourtId}-${entry.day}-${slotTime}`;
        const existing = slotMap.get(key);

        if (existing) {
          conflicts.push(
            `${DAY_NAMES[entry.day]} Court ${courtNum} ${slotTime}: "${entry.label}" conflicts with "${existing}"`,
          );
          continue;
        }

        slotMap.set(key, entry.label);

        allRecords.push({
          courtId: dbCourtId,
          sport: "badminton",
          dayOfWeek: entry.day,
          startTime: slotTime,
          endTime: nextSlotTime(slotTime),
          startDate,
          endDate: null,
          label: entry.label,
          userId: null,
          guestName: entry.guestName,
          guestPhone: entry.guestPhone || null,
          createdBy: null,
          isActive: true,
        });
      }
    }
  }

  // Print summary by day
  for (let day = 0; day <= 6; day++) {
    const dayRecords = allRecords.filter((r) => r.dayOfWeek === day);
    if (dayRecords.length === 0) continue;

    console.log(`\n${DAY_NAMES[day]} (${dayRecords.length} slots):`);

    // Group by label + courts for readable output
    const groups: {
      label: string;
      courts: Set<number>;
      start: string;
      end: string;
    }[] = [];

    // Sort by court then time
    const sorted = [...dayRecords].sort((a, b) => {
      if (a.courtId !== b.courtId) return a.courtId - b.courtId;
      return a.startTime.localeCompare(b.startTime);
    });

    for (const rec of sorted) {
      const courtName =
        Object.entries(COURT_MAP).find(([, v]) => v === rec.courtId)?.[0] ||
        "?";
      const last = groups[groups.length - 1];

      if (
        last &&
        last.label === rec.label &&
        last.end === rec.startTime &&
        last.courts.has(Number(courtName))
      ) {
        last.end = rec.endTime;
      } else {
        groups.push({
          label: rec.label,
          courts: new Set([Number(courtName)]),
          start: rec.startTime,
          end: rec.endTime,
        });
      }
    }

    // Merge groups with same label and time range
    const merged: {
      label: string;
      courts: number[];
      start: string;
      end: string;
    }[] = [];
    for (const g of groups) {
      const existing = merged.find(
        (m) => m.label === g.label && m.start === g.start && m.end === g.end,
      );
      if (existing) {
        for (const c of g.courts) existing.courts.push(c);
      } else {
        merged.push({
          label: g.label,
          courts: [...g.courts],
          start: g.start,
          end: g.end,
        });
      }
    }

    // Sort merged by start time
    merged.sort((a, b) => a.start.localeCompare(b.start));

    for (const m of merged) {
      const courtStr = m.courts
        .sort((a, b) => a - b)
        .map((c) => `Court ${c}`)
        .join(", ");
      const endDisplay = m.end === "24:00" ? "00:00 (midnight)" : m.end;
      console.log(`  ${m.start}-${endDisplay} | ${courtStr} | ${m.label}`);
    }
  }

  console.log(`\nTotal records to create: ${allRecords.length}`);

  if (conflicts.length > 0) {
    console.log(`\n⚠️  CONFLICTS DETECTED (${conflicts.length}):`);
    for (const c of conflicts) {
      console.log(`  ${c}`);
    }
    if (!DRY_RUN) {
      console.error(
        "\nAborting due to conflicts. Fix schedule data and retry.",
      );
      process.exit(1);
    }
  }

  if (DRY_RUN) {
    console.log("\nDry run complete. Run without --dry-run to insert records.");
    return;
  }

  // Insert all records in a transaction
  console.log("\nInserting records...");
  const created = await prisma.$transaction(
    allRecords.map((data) => prisma.recurringBooking.create({ data })),
  );

  console.log(
    `\nSuccessfully created ${created.length} recurring booking records.`,
  );

  // Verify counts per day
  for (let day = 0; day <= 6; day++) {
    const count = await prisma.recurringBooking.count({
      where: { dayOfWeek: day, isActive: true },
    });
    if (count > 0) {
      console.log(`  ${DAY_NAMES[day]}: ${count} slots`);
    }
  }
}

main()
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
