import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user || !isAdmin(session.user.email, session.user.isAdmin)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const groups = await prisma.trainingGroup.findMany({
      where: { isActive: true },
      include: {
        members: {
          select: {
            id: true,
            uid: true,
            name: true,
            phone: true,
            skillLevel: true,
          },
        },
        court: {
          select: { id: true, name: true },
        },
        teacher: {
          select: { id: true, name: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ groups });
  } catch (error) {
    console.error("Error fetching training groups:", error);
    return NextResponse.json(
      { error: "Failed to fetch training groups" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user || !isAdmin(session.user.email, session.user.isAdmin)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      name, sport, notes, memberIds,
      groupType, maxCapacity, duration,
      dayOfWeek, startTime, endTime,
      courtId, teacherId, pricePerSession, isJoinable,
    } = await request.json();

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Group name is required" },
        { status: 400 },
      );
    }

    const existing = await prisma.trainingGroup.findUnique({
      where: { name: name.trim() },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A group with this name already exists" },
        { status: 409 },
      );
    }

    const group = await prisma.trainingGroup.create({
      data: {
        name: name.trim(),
        sport: sport || "badminton",
        groupType: groupType || "ONE_TO_ONE",
        maxCapacity: maxCapacity || 1,
        duration: duration || 1.5,
        dayOfWeek: dayOfWeek ?? 0,
        startTime: startTime || "09:00",
        endTime: endTime || "10:30",
        courtId: courtId || null,
        teacherId: teacherId || null,
        pricePerSession: pricePerSession || null,
        isJoinable: isJoinable ?? true,
        notes: notes || null,
        members: {
          connect: (memberIds || []).map((id: string) => ({ id })),
        },
      },
      include: {
        members: {
          select: {
            id: true,
            uid: true,
            name: true,
            phone: true,
            skillLevel: true,
          },
        },
        court: { select: { id: true, name: true } },
        teacher: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ success: true, group });
  } catch (error) {
    console.error("Error creating training group:", error);
    return NextResponse.json(
      { error: "Failed to create training group" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user || !isAdmin(session.user.email, session.user.isAdmin)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      id, name, sport, notes, memberIds,
      groupType, maxCapacity, duration,
      dayOfWeek, startTime, endTime,
      courtId, teacherId, pricePerSession, isJoinable,
    } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "Group ID is required" },
        { status: 400 },
      );
    }

    const group = await prisma.trainingGroup.findUnique({
      where: { id },
      include: { members: { select: { id: true } } },
    });

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    if (name && name.trim() !== group.name) {
      const duplicate = await prisma.trainingGroup.findUnique({
        where: { name: name.trim() },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: "A group with this name already exists" },
          { status: 409 },
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (sport !== undefined) updateData.sport = sport;
    if (notes !== undefined) updateData.notes = notes || null;
    if (groupType !== undefined) updateData.groupType = groupType;
    if (maxCapacity !== undefined) updateData.maxCapacity = maxCapacity;
    if (duration !== undefined) updateData.duration = duration;
    if (dayOfWeek !== undefined) updateData.dayOfWeek = dayOfWeek;
    if (startTime !== undefined) updateData.startTime = startTime;
    if (endTime !== undefined) updateData.endTime = endTime;
    if (courtId !== undefined) updateData.courtId = courtId || null;
    if (teacherId !== undefined) updateData.teacherId = teacherId || null;
    if (pricePerSession !== undefined) updateData.pricePerSession = pricePerSession || null;
    if (isJoinable !== undefined) updateData.isJoinable = isJoinable;

    if (memberIds !== undefined) {
      updateData.members = {
        set: memberIds.map((mid: string) => ({ id: mid })),
      };
    }

    const updated = await prisma.trainingGroup.update({
      where: { id },
      data: updateData,
      include: {
        members: {
          select: {
            id: true,
            uid: true,
            name: true,
            phone: true,
            skillLevel: true,
          },
        },
        court: { select: { id: true, name: true } },
        teacher: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ success: true, group: updated });
  } catch (error) {
    console.error("Error updating training group:", error);
    return NextResponse.json(
      { error: "Failed to update training group" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user || !isAdmin(session.user.email, session.user.isAdmin)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "Group ID is required" },
        { status: 400 },
      );
    }

    await prisma.trainingGroup.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting training group:", error);
    return NextResponse.json(
      { error: "Failed to delete training group" },
      { status: 500 },
    );
  }
}
