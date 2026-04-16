"use client";

import Image from "next/image";
import { upload } from "@vercel/blob/client";
import { useMemo, useState } from "react";

type ProfileClientProps = {
  user: {
    name: string | null;
    email: string;
    image: string | null;
  };
};

function getInitial(name: string | null, email: string) {
  return (name?.trim()?.[0] ?? email.trim()?.[0] ?? "U").toUpperCase();
}

export function ProfileClient({ user }: ProfileClientProps) {
  const [name, setName] = useState(user.name ?? "");
  const [currentImage, setCurrentImage] = useState<string | null>(user.image ?? null);
  const [profileStatus, setProfileStatus] = useState<string | null>(null);
  const [passwordStatus, setPasswordStatus] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const initial = useMemo(() => getInitial(name || user.name, user.email), [name, user.email, user.name]);

  async function saveProfile() {
    setSavingProfile(true);
    setProfileStatus(null);

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim() || null, image: currentImage }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (!res.ok || !json?.ok) throw new Error(json?.message ?? `Failed to save profile (${res.status})`);
      setProfileStatus("Profile updated.");
    } catch (e) {
      setProfileStatus(e instanceof Error ? e.message : "Failed to save profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function updatePassword() {
    setPasswordStatus(null);

    if (newPassword !== confirmPassword) {
      setPasswordStatus("New password and confirmation do not match.");
      return;
    }

    setSavingPassword(true);

    try {
      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (!res.ok || !json?.ok) throw new Error(json?.message ?? `Failed to update password (${res.status})`);
      setPasswordStatus("Password updated.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e) {
      setPasswordStatus(e instanceof Error ? e.message : "Failed to update password.");
    } finally {
      setSavingPassword(false);
    }
  }

  async function uploadAvatar(file: File) {
    setUploadingAvatar(true);
    setProfileStatus(null);

    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
      const blob = await upload(`profile-avatars/${Date.now()}-${safeName}`, file, {
        access: "public",
        handleUploadUrl: "/api/profile/avatar-upload",
      });
      setCurrentImage(blob.url);
      setProfileStatus("Avatar uploaded. Save profile to keep it.");
    } catch (e) {
      setProfileStatus(e instanceof Error ? e.message : "Failed to upload avatar.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Your profile</h2>
            <p className="mt-1 text-sm text-zinc-600">Update your display name and profile photo.</p>
          </div>

          <div className="flex items-center gap-3 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-2">
            {currentImage ? (
              <Image src={currentImage} alt="Profile avatar" width={40} height={40} className="h-10 w-10 rounded-full object-cover" unoptimized />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white">
                {initial}
              </div>
            )}
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-zinc-900">{name.trim() || user.name || user.email}</div>
              <div className="truncate text-xs text-zinc-500">{user.email}</div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_240px]">
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-600">Display name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500"
                placeholder="Your name"
                type="text"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void saveProfile()}
                disabled={savingProfile}
                className="inline-flex h-10 items-center rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
              >
                {savingProfile ? "Saving…" : "Save profile"}
              </button>
              {profileStatus ? <p className="text-sm text-zinc-600">{profileStatus}</p> : null}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="text-sm font-semibold text-zinc-900">Profile photo</div>
            <div className="mt-3 flex justify-center">
              {currentImage ? (
                <Image src={currentImage} alt="Current profile photo" width={112} height={112} className="h-28 w-28 rounded-full object-cover ring-1 ring-zinc-200" unoptimized />
              ) : (
                <div className="flex h-28 w-28 items-center justify-center rounded-full bg-zinc-900 text-3xl font-semibold text-white">
                  {initial}
                </div>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <label className="inline-flex cursor-pointer items-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-100">
                <input
                  type="file"
                  className="hidden"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    void uploadAvatar(file);
                    e.currentTarget.value = "";
                  }}
                  disabled={uploadingAvatar}
                />
                {uploadingAvatar ? "Uploading…" : currentImage ? "Replace photo" : "Upload photo"}
              </label>
              {currentImage ? (
                <button
                  type="button"
                  onClick={() => setCurrentImage(null)}
                  className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                >
                  Remove
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Reset password</h2>
          <p className="mt-1 text-sm text-zinc-600">Use your current password to set a new one.</p>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-600">Current password</label>
            <input
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500"
              type="password"
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-600">New password</label>
            <input
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500"
              type="password"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-600">Confirm new password</label>
            <input
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500"
              type="password"
              autoComplete="new-password"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void updatePassword()}
            disabled={savingPassword}
            className="inline-flex h-10 items-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-100 disabled:opacity-60"
          >
            {savingPassword ? "Updating…" : "Update password"}
          </button>
          {passwordStatus ? <p className="text-sm text-zinc-600">{passwordStatus}</p> : null}
        </div>
      </section>
    </div>
  );
}
