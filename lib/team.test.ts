/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from "vitest";

vi.mock("@keystatic/core/reader", () => {
  const mockRead = vi.fn();
  return {
    createReader: () => ({
      singletons: {
        team: {
          read: mockRead,
        },
      },
    }),
    __mockRead: mockRead,
  };
});

import { getTeam } from "./team";
import { createReader } from "@keystatic/core/reader";

describe("lib/team — getTeam", () => {
  const reader = (createReader as any)();

  it("returns empty members when team singleton read returns null", async () => {
    reader.singletons.team.read.mockResolvedValueOnce(null);
    const result = await getTeam();
    expect(result).toEqual({ members: [] });
  });

  it("returns mapped members and professionalContact correctly", async () => {
    reader.singletons.team.read.mockResolvedValueOnce({
      professionalContact: {
        email: "team@cherenkov.id",
        label: "General & press inquiries",
      },
      members: [
        {
          name: "Test Member",
          role: "Founder — Astronomy",
          bioEn: "English Bio",
          bioId: "Indonesian Bio",
          photoUrl: "https://blob.vercel-storage.com/photo.jpg",
          personalContact: "test@example.com",
        },
      ],
    });

    const result = await getTeam();
    expect(result.professionalContact).toEqual({
      email: "team@cherenkov.id",
      label: "General & press inquiries",
    });
    expect(result.members).toHaveLength(1);
    expect(result.members[0]).toEqual({
      name: "Test Member",
      role: "Founder — Astronomy",
      bioEn: "English Bio",
      bioId: "Indonesian Bio",
      photoUrl: "https://blob.vercel-storage.com/photo.jpg",
      personalContact: "test@example.com",
      personalContacts: [{ label: "Email", href: "mailto:test@example.com", value: "test@example.com" }],
    });
  });

  it("maps multiple personal contact links for each member", async () => {
    reader.singletons.team.read.mockResolvedValueOnce({
      professionalContact: {
        email: "projectcherenkov@gmail.com",
        label: "General inquiries",
      },
      members: [
        {
          name: "Member One",
          role: "Research",
          bioEn: "English Bio",
          bioId: "Bio Indonesia",
          photoUrl: "https://example.com/photo.jpg",
          personalContact: "member1@example.com",
          personalContacts: [
            { label: "Email", href: "mailto:member1@example.com", value: "member1@example.com" },
            { label: "Instagram", href: "https://instagram.com/member1", value: "@member1" },
          ],
        },
      ],
    });

    const result = await getTeam();
    expect(result.members[0]).toMatchObject({
      name: "Member One",
      personalContact: "member1@example.com",
      personalContacts: [
        { label: "Email", href: "mailto:member1@example.com", value: "member1@example.com" },
        { label: "Instagram", href: "https://instagram.com/member1", value: "@member1" },
      ],
    });
  });

  it("handles missing professionalContact and optional member fields gracefully", async () => {
    reader.singletons.team.read.mockResolvedValueOnce({
      professionalContact: {
        email: "",
        label: "",
      },
      members: [
        {
          name: "Minimal Member",
          role: "",
          bioEn: "",
          bioId: "",
          photoUrl: null,
          personalContact: "",
        },
      ],
    });

    const result = await getTeam();
    expect(result.professionalContact).toBeUndefined();
    expect(result.members).toHaveLength(1);
    expect(result.members[0]).toEqual({
      name: "Minimal Member",
      role: undefined,
      bioEn: "",
      bioId: "",
      photoUrl: null,
      personalContact: undefined,
      personalContacts: [],
    });
  });
});
