--
-- PostgreSQL database dump
--

\restrict NFB8kynMkrBK0GTtBy36Rv7TCQgl2XEDVcsFvdVw6bvhPuWgJxmaZEBQGfbHM1h

-- Dumped from database version 14.20 (Debian 14.20-1.pgdg13+1)
-- Dumped by pg_dump version 14.20 (Debian 14.20-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: app_version_platform_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_version_platform_enum AS ENUM (
    'ios',
    'android',
    'all'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: app_version; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_version (
    id integer NOT NULL,
    platform public.app_version_platform_enum DEFAULT 'all'::public.app_version_platform_enum NOT NULL,
    "minSupportedVersion" character varying NOT NULL,
    "latestVersion" character varying NOT NULL,
    "forceUpdate" boolean DEFAULT false NOT NULL,
    "releaseNotes" character varying,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: app_version_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.app_version_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: app_version_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.app_version_id_seq OWNED BY public.app_version.id;


--
-- Name: appointment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appointment (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
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
    "staffMemberId" uuid
);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    description text,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expenses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
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
    "userId" uuid
);


--
-- Name: log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.log (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    description text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "userId" uuid
);


--
-- Name: post; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.post (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    url text NOT NULL,
    title text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "userId" uuid
);


--
-- Name: reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reports (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "startDate" timestamp with time zone NOT NULL,
    "endDate" timestamp with time zone NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "userId" uuid
);


--
-- Name: schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schedules (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "dayOfWeek" integer NOT NULL,
    "startTime" character varying NOT NULL,
    "endTime" character varying NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.services (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
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


--
-- Name: staff_member; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_member (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "firstName" text NOT NULL,
    "lastName" text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "deletedAt" timestamp with time zone
);


--
-- Name: staff_member_schedules_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_member_schedules_schedules (
    "staffMemberId" uuid NOT NULL,
    "schedulesId" uuid NOT NULL
);


--
-- Name: staff_member_services_services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_member_services_services (
    "staffMemberId" uuid NOT NULL,
    "servicesId" uuid NOT NULL
);


--
-- Name: subcategories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subcategories (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "categoryId" uuid
);


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_settings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    key character varying NOT NULL,
    value text NOT NULL,
    type text NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "firstName" character varying NOT NULL,
    "lastName" character varying NOT NULL,
    "imageUrl" text,
    email character varying NOT NULL,
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


--
-- Name: app_version id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_version ALTER COLUMN id SET DEFAULT nextval('public.app_version_id_seq'::regclass);


--
-- Name: categories PK_24dbc6126a28ff948da33e97d3b; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT "PK_24dbc6126a28ff948da33e97d3b" PRIMARY KEY (id);


--
-- Name: staff_member PK_342343208cbc30b3c14a976b0a0; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_member
    ADD CONSTRAINT "PK_342343208cbc30b3c14a976b0a0" PRIMARY KEY (id);


--
-- Name: log PK_350604cbdf991d5930d9e618fbd; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.log
    ADD CONSTRAINT "PK_350604cbdf991d5930d9e618fbd" PRIMARY KEY (id);


--
-- Name: staff_member_schedules_schedules PK_50be0b0f8bc4dcd8a8d669e944d; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_member_schedules_schedules
    ADD CONSTRAINT "PK_50be0b0f8bc4dcd8a8d669e944d" PRIMARY KEY ("staffMemberId", "schedulesId");


--
-- Name: subcategories PK_793ef34ad0a3f86f09d4837007c; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subcategories
    ADD CONSTRAINT "PK_793ef34ad0a3f86f09d4837007c" PRIMARY KEY (id);


--
-- Name: schedules PK_7e33fc2ea755a5765e3564e66dd; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT "PK_7e33fc2ea755a5765e3564e66dd" PRIMARY KEY (id);


--
-- Name: system_settings PK_82521f08790d248b2a80cc85d40; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT "PK_82521f08790d248b2a80cc85d40" PRIMARY KEY (id);


--
-- Name: expenses PK_94c3ceb17e3140abc9282c20610; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT "PK_94c3ceb17e3140abc9282c20610" PRIMARY KEY (id);


--
-- Name: users PK_a3ffb1c0c8416b9fc6f907b7433; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY (id);


--
-- Name: staff_member_services_services PK_afa7ae2b9eb7ea77fe56dd8f690; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_member_services_services
    ADD CONSTRAINT "PK_afa7ae2b9eb7ea77fe56dd8f690" PRIMARY KEY ("staffMemberId", "servicesId");


--
-- Name: services PK_ba2d347a3168a296416c6c5ccb2; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT "PK_ba2d347a3168a296416c6c5ccb2" PRIMARY KEY (id);


--
-- Name: post PK_be5fda3aac270b134ff9c21cdee; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post
    ADD CONSTRAINT "PK_be5fda3aac270b134ff9c21cdee" PRIMARY KEY (id);


--
-- Name: reports PK_d9013193989303580053c0b5ef6; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT "PK_d9013193989303580053c0b5ef6" PRIMARY KEY (id);


--
-- Name: appointment PK_e8be1a53027415e709ce8a2db74; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment
    ADD CONSTRAINT "PK_e8be1a53027415e709ce8a2db74" PRIMARY KEY (id);


--
-- Name: app_version PK_f2573b981a7eac664875e7483ac; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_version
    ADD CONSTRAINT "PK_f2573b981a7eac664875e7483ac" PRIMARY KEY (id);


--
-- Name: categories UQ_8b0be371d28245da6e4f4b61878; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT "UQ_8b0be371d28245da6e4f4b61878" UNIQUE (name);


--
-- Name: users UQ_97672ac88f789774dd47f7c8be3; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE (email);


--
-- Name: subcategories UQ_d1a3a67c9c5d440edf414af1271; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subcategories
    ADD CONSTRAINT "UQ_d1a3a67c9c5d440edf414af1271" UNIQUE (name);


--
-- Name: IDX_18d243b021d6aaea37a6acdcf0; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_18d243b021d6aaea37a6acdcf0" ON public.staff_member_services_services USING btree ("servicesId");


--
-- Name: IDX_1c04b1e959e0f701c18a24d2b9; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_1c04b1e959e0f701c18a24d2b9" ON public.staff_member_schedules_schedules USING btree ("schedulesId");


--
-- Name: IDX_2ba32ed1e51bc27b30dbeb6dd0; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_2ba32ed1e51bc27b30dbeb6dd0" ON public.staff_member_services_services USING btree ("staffMemberId");


--
-- Name: IDX_deb84012136ebbe294319e7dbc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_deb84012136ebbe294319e7dbc" ON public.staff_member_schedules_schedules USING btree ("staffMemberId");


--
-- Name: staff_member_services_services FK_18d243b021d6aaea37a6acdcf0d; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_member_services_services
    ADD CONSTRAINT "FK_18d243b021d6aaea37a6acdcf0d" FOREIGN KEY ("servicesId") REFERENCES public.services(id);


--
-- Name: staff_member_schedules_schedules FK_1c04b1e959e0f701c18a24d2b90; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_member_schedules_schedules
    ADD CONSTRAINT "FK_1c04b1e959e0f701c18a24d2b90" FOREIGN KEY ("schedulesId") REFERENCES public.schedules(id);


--
-- Name: appointment FK_2a990a304a43ccc7415bf7e3a99; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment
    ADD CONSTRAINT "FK_2a990a304a43ccc7415bf7e3a99" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: staff_member_services_services FK_2ba32ed1e51bc27b30dbeb6dd0a; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_member_services_services
    ADD CONSTRAINT "FK_2ba32ed1e51bc27b30dbeb6dd0a" FOREIGN KEY ("staffMemberId") REFERENCES public.staff_member(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: expenses FK_3d211de716f0f14ea7a8a4b1f2c; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT "FK_3d211de716f0f14ea7a8a4b1f2c" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: post FK_5c1cf55c308037b5aca1038a131; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post
    ADD CONSTRAINT "FK_5c1cf55c308037b5aca1038a131" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: appointment FK_917be968a18bab4c5f12641a6f5; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment
    ADD CONSTRAINT "FK_917be968a18bab4c5f12641a6f5" FOREIGN KEY ("staffMemberId") REFERENCES public.staff_member(id);


--
-- Name: expenses FK_ac0801a1760c5f9ce43c03bacd0; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT "FK_ac0801a1760c5f9ce43c03bacd0" FOREIGN KEY ("categoryId") REFERENCES public.categories(id);


--
-- Name: expenses FK_b6ee7d2bc11bc7a1421179a340e; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT "FK_b6ee7d2bc11bc7a1421179a340e" FOREIGN KEY ("subcategoryId") REFERENCES public.subcategories(id);


--
-- Name: reports FK_bed415cd29716cd707e9cb3c09c; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT "FK_bed415cd29716cd707e9cb3c09c" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: log FK_cea2ed3a494729d4b21edbd2983; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.log
    ADD CONSTRAINT "FK_cea2ed3a494729d4b21edbd2983" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: appointment FK_cee8b55c31f700609674da96b0b; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment
    ADD CONSTRAINT "FK_cee8b55c31f700609674da96b0b" FOREIGN KEY ("serviceId") REFERENCES public.services(id);


--
-- Name: subcategories FK_d1fe096726c3c5b8a500950e448; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subcategories
    ADD CONSTRAINT "FK_d1fe096726c3c5b8a500950e448" FOREIGN KEY ("categoryId") REFERENCES public.categories(id) ON DELETE CASCADE;


--
-- Name: staff_member_schedules_schedules FK_deb84012136ebbe294319e7dbcc; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_member_schedules_schedules
    ADD CONSTRAINT "FK_deb84012136ebbe294319e7dbcc" FOREIGN KEY ("staffMemberId") REFERENCES public.staff_member(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict NFB8kynMkrBK0GTtBy36Rv7TCQgl2XEDVcsFvdVw6bvhPuWgJxmaZEBQGfbHM1h

