// Import this FIRST in a spec that needs POST /auth/register: ConfigModule reads
// the environment as soon as AppModule is imported, so the flag has to be set
// before that import (Jest gives each test file its own copy of process.env).
process.env.ALLOW_PUBLIC_REGISTRATION = "true";
