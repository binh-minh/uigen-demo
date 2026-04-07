import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAuth } from "@/hooks/use-auth";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock server actions
vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Initial state ───────────────────────────────────────────────────────────

  test("starts with isLoading false", () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isLoading).toBe(false);
  });

  test("exposes signIn and signUp functions", () => {
    const { result } = renderHook(() => useAuth());
    expect(typeof result.current.signIn).toBe("function");
    expect(typeof result.current.signUp).toBe("function");
  });

  // ─── signIn happy paths ───────────────────────────────────────────────────────

  describe("signIn", () => {
    test("sets isLoading true during call and resets after", async () => {
      let resolveSignIn!: (v: any) => void;
      (signInAction as any).mockReturnValue(
        new Promise((res) => (resolveSignIn = res))
      );
      (getAnonWorkData as any).mockReturnValue(null);
      (getProjects as any).mockResolvedValue([{ id: "p1" }]);

      const { result } = renderHook(() => useAuth());

      let signInPromise!: Promise<any>;
      act(() => {
        signInPromise = result.current.signIn("a@b.com", "password1");
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveSignIn({ success: true });
        await signInPromise;
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("returns the action result", async () => {
      const expected = { success: true };
      (signInAction as any).mockResolvedValue(expected);
      (getAnonWorkData as any).mockReturnValue(null);
      (getProjects as any).mockResolvedValue([{ id: "p1" }]);

      const { result } = renderHook(() => useAuth());
      let returned: any;
      await act(async () => {
        returned = await result.current.signIn("a@b.com", "password1");
      });

      expect(returned).toEqual(expected);
    });

    test("calls signIn action with correct credentials", async () => {
      (signInAction as any).mockResolvedValue({ success: false, error: "bad" });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@test.com", "secret123");
      });

      expect(signInAction).toHaveBeenCalledWith("user@test.com", "secret123");
    });

    // ── post-sign-in routing with anon work ──────────────────────────────────

    test("creates project from anon work and redirects when anon messages exist", async () => {
      const anonWork = {
        messages: [{ role: "user", content: "hello" }],
        fileSystemData: { "/": { type: "directory" } },
      };
      (signInAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue(anonWork);
      (createProject as any).mockResolvedValue({ id: "new-anon" });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("a@b.com", "pass1234");
      });

      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: anonWork.messages,
          data: anonWork.fileSystemData,
        })
      );
      expect(clearAnonWork).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/new-anon");
      expect(getProjects).not.toHaveBeenCalled();
    });

    test("skips anon work when messages array is empty", async () => {
      (signInAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue({ messages: [], fileSystemData: {} });
      (getProjects as any).mockResolvedValue([{ id: "existing" }]);

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("a@b.com", "pass1234");
      });

      expect(createProject).not.toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/existing");
    });

    test("skips anon work when getAnonWorkData returns null", async () => {
      (signInAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue(null);
      (getProjects as any).mockResolvedValue([{ id: "existing" }]);

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("a@b.com", "pass1234");
      });

      expect(createProject).not.toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/existing");
    });

    // ── post-sign-in routing without anon work ───────────────────────────────

    test("redirects to most recent existing project when no anon work", async () => {
      (signInAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue(null);
      (getProjects as any).mockResolvedValue([
        { id: "recent" },
        { id: "older" },
      ]);

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("a@b.com", "pass1234");
      });

      expect(mockPush).toHaveBeenCalledWith("/recent");
    });

    test("creates new project and redirects when user has no projects", async () => {
      (signInAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue(null);
      (getProjects as any).mockResolvedValue([]);
      (createProject as any).mockResolvedValue({ id: "brand-new" });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("a@b.com", "pass1234");
      });

      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({ messages: [], data: {} })
      );
      expect(mockPush).toHaveBeenCalledWith("/brand-new");
    });

    // ── failure path ─────────────────────────────────────────────────────────

    test("does not run post-sign-in logic when signIn fails", async () => {
      (signInAction as any).mockResolvedValue({
        success: false,
        error: "Invalid credentials",
      });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("a@b.com", "wrongpass");
      });

      expect(getAnonWorkData).not.toHaveBeenCalled();
      expect(getProjects).not.toHaveBeenCalled();
      expect(createProject).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });

    test("resets isLoading after failed signIn", async () => {
      (signInAction as any).mockResolvedValue({ success: false, error: "err" });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("a@b.com", "pass1234");
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("resets isLoading even when action throws", async () => {
      (signInAction as any).mockRejectedValue(new Error("network error"));

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        try {
          await result.current.signIn("a@b.com", "pass1234");
        } catch {
          // expected
        }
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  // ─── signUp happy paths ───────────────────────────────────────────────────────

  describe("signUp", () => {
    test("calls signUp action with correct credentials", async () => {
      (signUpAction as any).mockResolvedValue({ success: false, error: "taken" });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signUp("new@test.com", "newpass1");
      });

      expect(signUpAction).toHaveBeenCalledWith("new@test.com", "newpass1");
    });

    test("runs post-sign-in flow on success", async () => {
      (signUpAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue(null);
      (getProjects as any).mockResolvedValue([]);
      (createProject as any).mockResolvedValue({ id: "new-user-project" });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signUp("new@test.com", "newpass1");
      });

      expect(mockPush).toHaveBeenCalledWith("/new-user-project");
    });

    test("migrates anon work into new account on signUp", async () => {
      const anonWork = {
        messages: [{ role: "user", content: "draft" }],
        fileSystemData: { "/app.tsx": { type: "file", content: "" } },
      };
      (signUpAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue(anonWork);
      (createProject as any).mockResolvedValue({ id: "migrated" });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signUp("new@test.com", "newpass1");
      });

      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: anonWork.messages,
          data: anonWork.fileSystemData,
        })
      );
      expect(clearAnonWork).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/migrated");
    });

    test("does not run post-sign-in logic when signUp fails", async () => {
      (signUpAction as any).mockResolvedValue({
        success: false,
        error: "Email already registered",
      });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signUp("existing@test.com", "pass1234");
      });

      expect(mockPush).not.toHaveBeenCalled();
    });

    test("sets isLoading true during call and resets after", async () => {
      let resolveSignUp!: (v: any) => void;
      (signUpAction as any).mockReturnValue(
        new Promise((res) => (resolveSignUp = res))
      );
      (getAnonWorkData as any).mockReturnValue(null);
      (getProjects as any).mockResolvedValue([{ id: "p1" }]);

      const { result } = renderHook(() => useAuth());

      let signUpPromise!: Promise<any>;
      act(() => {
        signUpPromise = result.current.signUp("a@b.com", "password1");
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveSignUp({ success: true });
        await signUpPromise;
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("resets isLoading even when signUp action throws", async () => {
      (signUpAction as any).mockRejectedValue(new Error("server error"));

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        try {
          await result.current.signUp("a@b.com", "pass1234");
        } catch {
          // expected
        }
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("returns the action result", async () => {
      const expected = { success: false, error: "Email already registered" };
      (signUpAction as any).mockResolvedValue(expected);

      const { result } = renderHook(() => useAuth());
      let returned: any;
      await act(async () => {
        returned = await result.current.signUp("existing@test.com", "pass1234");
      });

      expect(returned).toEqual(expected);
    });
  });
});
