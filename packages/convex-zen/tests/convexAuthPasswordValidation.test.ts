import { describe, expect, it, vi } from "vitest";
import { ConvexZen, type StandardSchemaV1 } from "../src/client";

const component = {
  core: {
    gateway: {
      signUp: "core/gateway:signUp",
      signIn: "core/gateway:signIn",
      requestPasswordReset: "core/gateway:requestPasswordReset",
      resetPassword: "core/gateway:resetPassword",
    },
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
      emailPassword: {
        sendVerification: vi.fn(async () => {}),
        sendPasswordReset: vi.fn(async () => {}),
        validatePassword: schema,
      },
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
      emailPassword: {
        sendVerification: vi.fn(async () => {}),
        sendPasswordReset: vi.fn(async () => {}),
        validatePassword: schema,
      },
    });

    await auth.signUp(
      { runMutation },
      {
        email: "user@example.com",
        password: "ValidPassword123!",
      }
    );

    expect(runMutation).toHaveBeenCalledTimes(1);
    expect(runMutation).toHaveBeenCalledWith("core/gateway:signUp", {
      email: "user@example.com",
      password: "ValidPassword123!",
      defaultRole: undefined,
    });
  });

  it("keeps callback-based validation behavior", async () => {
    const runMutation = vi.fn(async () => ({ status: "valid" }));
    const auth = new ConvexZen(component, {
      emailPassword: {
        validatePassword: ({ password }) =>
          password.endsWith("!") ? null : "Password must end with !",
      },
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

  it("throws for an invalid password reset code", async () => {
    const runMutation = vi.fn(async () => ({ status: "invalid" }));
    const auth = new ConvexZen(component, {
      emailPassword: {
        validatePassword: () => null,
      },
    });

    await expect(
      auth.resetPassword(
        { runMutation },
        {
          email: "user@example.com",
          code: "WRONG123",
          newPassword: "ValidPassword123!",
        }
      )
    ).rejects.toThrow("Invalid password reset code");
  });

  it("supports backend-only duplicate sign-up reporting without sending email", async () => {
    const runMutation = vi.fn(async () => ({
      status: "verification_required",
      verificationCode: null,
      suppressedReason: "email_already_registered",
    }));
    const sendVerification = vi.fn(async () => {});
    const onSuppressedEvent = vi.fn(async () => {});
    const auth = new ConvexZen(component, {
      emailPassword: {
        sendVerification,
        sendPasswordReset: vi.fn(async () => {}),
        onSuppressedEvent,
      },
    });

    await expect(
      auth.signUp(
        { runMutation },
        {
          email: "existing@example.com",
          password: "ValidPassword123!",
          ipAddress: "127.0.0.1",
        }
      )
    ).resolves.toEqual({ status: "verification_required" });

    expect(sendVerification).not.toHaveBeenCalled();
    expect(onSuppressedEvent).toHaveBeenCalledWith({
      flow: "signUp",
      reason: "email_already_registered",
      email: "existing@example.com",
      ipAddress: "127.0.0.1",
    });
  });

  it("supports backend-only password reset suppression reporting without surfacing to UI", async () => {
    const runMutation = vi.fn(async () => ({
      status: "sent",
      resetCode: null,
      suppressedReason: "email_not_found",
    }));
    const sendPasswordReset = vi.fn(async () => {});
    const onSuppressedEvent = vi.fn(async () => {});
    const auth = new ConvexZen(component, {
      emailPassword: {
        sendVerification: vi.fn(async () => {}),
        sendPasswordReset,
        onSuppressedEvent,
      },
    });

    await expect(
      auth.requestPasswordReset(
        { runMutation },
        {
          email: "missing@example.com",
          ipAddress: "127.0.0.1",
        }
      )
    ).resolves.toEqual({ status: "sent" });

    expect(sendPasswordReset).not.toHaveBeenCalled();
    expect(onSuppressedEvent).toHaveBeenCalledWith({
      flow: "requestPasswordReset",
      reason: "email_not_found",
      email: "missing@example.com",
      ipAddress: "127.0.0.1",
    });
  });

  it("throws for an expired password reset code", async () => {
    const runMutation = vi.fn(async () => ({ status: "expired" }));
    const auth = new ConvexZen(component, {
      emailPassword: {
        validatePassword: () => null,
      },
    });

    await expect(
      auth.resetPassword(
        { runMutation },
        {
          email: "user@example.com",
          code: "EXPIRED1",
          newPassword: "ValidPassword123!",
        }
      )
    ).rejects.toThrow("Password reset code has expired");
  });

  it("throws after too many invalid password reset attempts", async () => {
    const runMutation = vi.fn(async () => ({ status: "too_many_attempts" }));
    const auth = new ConvexZen(component, {
      emailPassword: {
        validatePassword: () => null,
      },
    });

    await expect(
      auth.resetPassword(
        { runMutation },
        {
          email: "user@example.com",
          code: "LOCKED01",
          newPassword: "ValidPassword123!",
        }
      )
    ).rejects.toThrow("Too many invalid password reset attempts");
  });

  it("throws when sign-up email delivery is not configured", async () => {
    const auth = new ConvexZen(component, {});

    await expect(
      auth.signUp(
        { runMutation: vi.fn(async () => ({ status: "verification_required" })) },
        {
          email: "user@example.com",
          password: "ValidPassword123!",
        }
      )
    ).rejects.toThrow(
      "emailPassword.sendVerification is required for email/password sign-up"
    );
  });

  it("throws when password reset email delivery is not configured", async () => {
    const auth = new ConvexZen(component, {});

    await expect(
      auth.requestPasswordReset(
        { runMutation: vi.fn(async () => ({ status: "sent" })) },
        {
          email: "user@example.com",
        }
      )
    ).rejects.toThrow(
      "emailPassword.sendPasswordReset is required for password reset"
    );
  });

  it("defaults sign-in to requiring verified email", async () => {
    const runMutation = vi.fn(async () => ({
      sessionToken: "token",
      userId: "user_1",
    }));
    const auth = new ConvexZen(component, {});

    await auth.signIn(
      { runMutation },
      {
        email: "user@example.com",
        password: "ValidPassword123!",
      }
    );

    expect(runMutation).toHaveBeenCalledWith("core/gateway:signIn", {
      email: "user@example.com",
      password: "ValidPassword123!",
      requireVerification: true,
      checkBanned: false,
    });
  });

  it("allows disabling email verification on sign-in", async () => {
    const runMutation = vi.fn(async () => ({
      sessionToken: "token",
      userId: "user_1",
    }));
    const auth = new ConvexZen(component, {
      emailPassword: {
        requireVerification: false,
      },
    });

    await auth.signIn(
      { runMutation },
      {
        email: "user@example.com",
        password: "ValidPassword123!",
      }
    );

    expect(runMutation).toHaveBeenCalledWith("core/gateway:signIn", {
      email: "user@example.com",
      password: "ValidPassword123!",
      requireVerification: false,
      checkBanned: false,
    });
  });
});
