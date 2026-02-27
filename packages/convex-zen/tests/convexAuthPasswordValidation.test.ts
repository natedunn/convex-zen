import { describe, expect, it, vi } from "vitest";
import { ConvexZen, type StandardSchemaV1 } from "../src/client";

const component = {
  gateway: {
    signUp: "gateway:signUp",
    resetPassword: "gateway:resetPassword",
  },
};

describe("ConvexZen password validation", () => {
  it("accepts a Standard Schema validator for password strings", async () => {
    const runMutation = vi.fn(async () => ({
      status: "verification_required",
      verificationCode: "ABCDEFGH",
    }));
    const schema: StandardSchemaV1<string> = {
      "~standard": {
        version: 1,
        vendor: "test",
        validate: async (value) => {
          if (typeof value === "string" && value.includes("!")) {
            return { value };
          }
          return {
            issues: [{ message: "Password must include !" }],
          };
        },
      },
    };

    const auth = new ConvexZen(component, {
      emailProvider: {
        sendVerificationEmail: vi.fn(async () => {}),
        sendPasswordResetEmail: vi.fn(async () => {}),
      },
      validatePassword: schema,
    });

    await expect(
      auth.signUp(
        { runMutation },
        {
          email: "user@example.com",
          password: "NoBangPassword123",
        }
      )
    ).rejects.toThrow("Password must include !");

    expect(runMutation).not.toHaveBeenCalled();
  });

  it("supports Standard Schema validators that expect input object shape", async () => {
    const runMutation = vi.fn(async () => ({
      status: "verification_required",
      verificationCode: "ABCDEFGH",
    }));
    const schema: StandardSchemaV1<{ password: string; context: string }> = {
      "~standard": {
        version: 1,
        vendor: "test",
        validate: async (value) => {
          if (
            value &&
            typeof value === "object" &&
            "password" in value &&
            typeof value.password === "string" &&
            "context" in value &&
            value.context === "signUp"
          ) {
            return { value };
          }
          return {
            issues: [{ message: "Invalid password validation context" }],
          };
        },
      },
    };

    const auth = new ConvexZen(component, {
      emailProvider: {
        sendVerificationEmail: vi.fn(async () => {}),
        sendPasswordResetEmail: vi.fn(async () => {}),
      },
      validatePassword: schema,
    });

    await auth.signUp(
      { runMutation },
      {
        email: "user@example.com",
        password: "ValidPassword123!",
      }
    );

    expect(runMutation).toHaveBeenCalledTimes(1);
    expect(runMutation).toHaveBeenCalledWith("gateway:signUp", {
      email: "user@example.com",
      password: "ValidPassword123!",
      defaultRole: undefined,
    });
  });

  it("keeps callback-based validation behavior", async () => {
    const runMutation = vi.fn(async () => ({ status: "valid" }));
    const auth = new ConvexZen(component, {
      validatePassword: ({ password }) =>
        password.endsWith("!") ? null : "Password must end with !",
    });

    await expect(
      auth.resetPassword(
        { runMutation },
        {
          email: "user@example.com",
          code: "1234",
          newPassword: "ValidPassword123",
        }
      )
    ).rejects.toThrow("Password must end with !");

    expect(runMutation).not.toHaveBeenCalled();
  });
});
