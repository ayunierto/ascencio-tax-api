import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1765509075060 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create uuid-ossp extension
    await queryRunner.query(
      `CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;`,
    );

    // Create ENUM types
    await queryRunner.query(
      `CREATE TYPE public.app_version_platform_enum AS ENUM ('ios', 'android', 'all');`,
    );

    // Create tables
    await queryRunner.query(`
            CREATE TABLE public.app_version (
                id SERIAL PRIMARY KEY,
                platform public.app_version_platform_enum DEFAULT 'all'::public.app_version_platform_enum NOT NULL,
                "minSupportedVersion" character varying NOT NULL,
                "latestVersion" character varying NOT NULL,
                "forceUpdate" boolean DEFAULT false NOT NULL,
                "releaseNotes" character varying,
                "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
                "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
            );
        `);

    await queryRunner.query(`
            CREATE TABLE public.users (
                id uuid DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
                "firstName" character varying NOT NULL,
                "lastName" character varying NOT NULL,
                "imageUrl" text,
                email character varying NOT NULL UNIQUE,
                password character varying NOT NULL,
                "countryCode" text,
                "phoneNumber" text,
                "timeZone" character varying NOT NULL,
                locale text DEFAULT 'en-CA'::text NOT NULL,
                "isActive" boolean DEFAULT true NOT NULL,
                roles text[] DEFAULT '{user}'::text[] NOT NULL,
                "isEmailVerified" boolean DEFAULT false NOT NULL,
                "verificationCode" text,
                "verificationCodeExpiresAt" timestamp without time zone,
                "passwordResetCode" text,
                "passwordResetExpiresAt" timestamp without time zone,
                "lastLoginAt" timestamp with time zone,
                "deletedAt" timestamp with time zone,
                "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
                "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
            );
        `);

    await queryRunner.query(`
            CREATE TABLE public.categories (
                id uuid DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
                name text NOT NULL UNIQUE,
                description text,
                "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
                "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
            );
        `);

    await queryRunner.query(`
            CREATE TABLE public.subcategories (
                id uuid DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
                name text NOT NULL UNIQUE,
                "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
                "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
                "categoryId" uuid,
                CONSTRAINT "FK_d1fe096726c3c5b8a500950e448" FOREIGN KEY ("categoryId") REFERENCES public.categories(id) ON DELETE CASCADE
            );
        `);

    await queryRunner.query(`
            CREATE TABLE public.expenses (
                id uuid DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
                merchant text NOT NULL,
                date timestamp with time zone NOT NULL,
                total numeric(10,2) NOT NULL,
                tax numeric(10,2) NOT NULL,
                "imageUrl" text,
                notes text,
                "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
                "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
                "categoryId" uuid,
                "subcategoryId" uuid,
                "userId" uuid,
                CONSTRAINT "FK_ac0801a1760c5f9ce43c03bacd0" FOREIGN KEY ("categoryId") REFERENCES public.categories(id),
                CONSTRAINT "FK_b6ee7d2bc11bc7a1421179a340e" FOREIGN KEY ("subcategoryId") REFERENCES public.subcategories(id),
                CONSTRAINT "FK_3d211de716f0f14ea7a8a4b1f2c" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE
            );
        `);

    await queryRunner.query(`
            CREATE TABLE public.reports (
                id uuid DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
                "startDate" timestamp with time zone NOT NULL,
                "endDate" timestamp with time zone NOT NULL,
                "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
                "userId" uuid,
                CONSTRAINT "FK_bed415cd29716cd707e9cb3c09c" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE
            );
        `);

    await queryRunner.query(`
            CREATE TABLE public.log (
                id uuid DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
                description text NOT NULL,
                "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
                "userId" uuid,
                CONSTRAINT "FK_cea2ed3a494729d4b21edbd2983" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE
            );
        `);

    await queryRunner.query(`
            CREATE TABLE public.post (
                id uuid DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
                url text NOT NULL,
                title text NOT NULL,
                "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
                "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
                "userId" uuid,
                CONSTRAINT "FK_5c1cf55c308037b5aca1038a131" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE
            );
        `);

    await queryRunner.query(`
            CREATE TABLE public.schedules (
                id uuid DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
                "dayOfWeek" integer NOT NULL,
                "startTime" character varying NOT NULL,
                "endTime" character varying NOT NULL,
                "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
                "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
            );
        `);

    await queryRunner.query(`
            CREATE TABLE public.services (
                id uuid DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
                name character varying NOT NULL,
                description character varying DEFAULT ''::character varying NOT NULL,
                address character varying,
                "durationMinutes" integer,
                "isAvailableOnline" boolean DEFAULT true NOT NULL,
                "imageUrl" character varying,
                "isActive" boolean DEFAULT true NOT NULL,
                "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
                "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
                "deletedAt" timestamp with time zone
            );
        `);

    await queryRunner.query(`
            CREATE TABLE public.staff_member (
                id uuid DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
                "firstName" text NOT NULL,
                "lastName" text NOT NULL,
                "isActive" boolean DEFAULT true NOT NULL,
                "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
                "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
                "deletedAt" timestamp with time zone
            );
        `);

    await queryRunner.query(`
            CREATE TABLE public.staff_member_schedules_schedules (
                "staffMemberId" uuid NOT NULL,
                "schedulesId" uuid NOT NULL,
                CONSTRAINT "PK_50be0b0f8bc4dcd8a8d669e944d" PRIMARY KEY ("staffMemberId", "schedulesId"),
                CONSTRAINT "FK_deb84012136ebbe294319e7dbcc" FOREIGN KEY ("staffMemberId") REFERENCES public.staff_member(id) ON UPDATE CASCADE ON DELETE CASCADE,
                CONSTRAINT "FK_1c04b1e959e0f701c18a24d2b90" FOREIGN KEY ("schedulesId") REFERENCES public.schedules(id)
            );
        `);

    await queryRunner.query(`
            CREATE TABLE public.staff_member_services_services (
                "staffMemberId" uuid NOT NULL,
                "servicesId" uuid NOT NULL,
                CONSTRAINT "PK_afa7ae2b9eb7ea77fe56dd8f690" PRIMARY KEY ("staffMemberId", "servicesId"),
                CONSTRAINT "FK_2ba32ed1e51bc27b30dbeb6dd0a" FOREIGN KEY ("staffMemberId") REFERENCES public.staff_member(id) ON UPDATE CASCADE ON DELETE CASCADE,
                CONSTRAINT "FK_18d243b021d6aaea37a6acdcf0d" FOREIGN KEY ("servicesId") REFERENCES public.services(id)
            );
        `);

    await queryRunner.query(`
            CREATE TABLE public.appointment (
                id uuid DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
                start timestamp with time zone NOT NULL,
                "end" timestamp with time zone NOT NULL,
                "timeZone" character varying NOT NULL,
                status character varying DEFAULT 'confirmed'::character varying NOT NULL,
                comments character varying,
                "calendarEventId" character varying NOT NULL,
                "zoomMeetingId" character varying NOT NULL,
                "zoomMeetingLink" character varying,
                source character varying DEFAULT 'app'::character varying NOT NULL,
                "cancellationReason" character varying(500),
                "cancelledAt" timestamp without time zone,
                "cancelledBy" character varying,
                "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
                "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
                "deletedAt" timestamp with time zone,
                "serviceId" uuid,
                "userId" uuid,
                "staffMemberId" uuid,
                CONSTRAINT "FK_cee8b55c31f700609674da96b0b" FOREIGN KEY ("serviceId") REFERENCES public.services(id),
                CONSTRAINT "FK_2a990a304a43ccc7415bf7e3a99" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE,
                CONSTRAINT "FK_917be968a18bab4c5f12641a6f5" FOREIGN KEY ("staffMemberId") REFERENCES public.staff_member(id)
            );
        `);

    await queryRunner.query(`
            CREATE TABLE public.system_settings (
                id uuid DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
                key character varying NOT NULL,
                value text NOT NULL,
                type text NOT NULL,
                "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
            );
        `);

    // Create indexes
    await queryRunner.query(
      `CREATE INDEX "IDX_deb84012136ebbe294319e7dbc" ON public.staff_member_schedules_schedules USING btree ("staffMemberId");`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1c04b1e959e0f701c18a24d2b9" ON public.staff_member_schedules_schedules USING btree ("schedulesId");`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2ba32ed1e51bc27b30dbeb6dd0" ON public.staff_member_services_services USING btree ("staffMemberId");`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_18d243b021d6aaea37a6acdcf0" ON public.staff_member_services_services USING btree ("servicesId");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order (respecting foreign key dependencies)
    await queryRunner.query(`DROP TABLE IF EXISTS public.system_settings;`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.appointment;`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS public.staff_member_services_services;`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS public.staff_member_schedules_schedules;`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS public.staff_member;`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.services;`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.schedules;`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.post;`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.log;`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.reports;`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.expenses;`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.subcategories;`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.categories;`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.users;`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.app_version;`);

    // Drop types
    await queryRunner.query(
      `DROP TYPE IF EXISTS public.app_version_platform_enum;`,
    );

    // Drop extension (optional, can leave it)
    // await queryRunner.query(`DROP EXTENSION IF EXISTS "uuid-ossp";`);
  }
}
