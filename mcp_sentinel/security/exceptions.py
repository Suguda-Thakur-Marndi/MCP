"""
Security exception hierarchy for MCP-Sentinel.
Adheres to:
- Security Rule #9: Do not expose stack traces or secrets to users.
- Security Rule #10: Fail closed for security-sensitive failures.
"""


class SentinelError(Exception):
    """
    Base exception for all MCP-Sentinel domain errors.
    Provides a safe client-facing message and internal diagnostic details.
    """

    def __init__(self, safe_message: str, internal_details: str | None = None):
        super().__init__(safe_message)
        self.safe_message = safe_message
        self.internal_details = internal_details or safe_message

    def to_dict(self) -> dict:
        return {
            "status": "error",
            "error_type": self.__class__.__name__,
            "message": self.safe_message,
        }


class SecurityValidationError(SentinelError):
    """
    Raised when tool input validation fails or prohibited patterns are detected.
    """

    def __init__(self, message: str, internal_details: str | None = None):
        super().__init__(safe_message=message, internal_details=internal_details)


class AuthorizationDeniedError(SentinelError):
    """
    Raised when an operation lacks necessary approval or approval validation fails.
    Fails closed: always denies execution.
    """

    def __init__(
        self,
        message: str = "Destructive operation cannot be authorized.",
        internal_details: str | None = None,
    ):
        super().__init__(safe_message=message, internal_details=internal_details)


class DatabaseOperationError(SentinelError):
    """
    Raised on database infrastructure or execution errors.
    Client message NEVER contains SQL text, table names, or connection strings.
    """

    def __init__(self, internal_details: str | None = None):
        super().__init__(
            safe_message="Unable to complete the requested database operation.",
            internal_details=internal_details or "Database execution error occurred.",
        )


class SecurityViolationError(SentinelError):
    """
    Raised when an active security violation (e.g. attempted SQL injection or replay) is detected.
    """

    def __init__(
        self,
        message: str = "Request rejected due to security policy violation.",
        internal_details: str | None = None,
    ):
        super().__init__(safe_message=message, internal_details=internal_details)


class ConfigurationError(SentinelError):
    """
    Raised when required configuration or secrets (e.g. GEMINI_API_KEY) are missing or invalid.
    """

    def __init__(
        self,
        safe_message: str = "Application configuration error.",
        internal_details: str | None = None,
    ):
        super().__init__(safe_message=safe_message, internal_details=internal_details)


class PolicyViolationError(SentinelError):
    """
    Raised when the Policy Engine denies a tool execution request.
    """

    def __init__(
        self,
        message: str = "Operation denied by server security policy.",
        internal_details: str | None = None,
    ):
        super().__init__(safe_message=message, internal_details=internal_details)


class ApprovalRequiredError(SentinelError):
    """
    Raised when the Policy Engine requires human approval before proceeding.
    """

    def __init__(
        self,
        message: str = "Human approval is required before execution.",
        internal_details: str | None = None,
    ):
        super().__init__(safe_message=message, internal_details=internal_details)
