import {
  INestApplication,
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { VersioningType } from '@nestjs/common';
import { AppVersionsController } from './app-versions.controller';
import { AppVersionsService } from './app-versions.service';
import { AppPlatform, AppVersion } from './entities/app-version.entity';
import { AuthGuard } from 'src/auth/guards/auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';

class AllowAllAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    request.user = {
      id: 'admin-user-id',
      roles: ['admin'],
    };
    return true;
  }
}

class AllowAllRolesGuard implements CanActivate {
  canActivate(): boolean {
    return true;
  }
}

class InMemoryAppVersionRepository {
  private items: AppVersion[] = [];
  private nextId = 1;

  create(
    payload: Partial<AppVersion> | Partial<AppVersion>[],
  ): AppVersion | AppVersion[] {
    if (Array.isArray(payload)) {
      return payload.map((entry) => this.create(entry) as AppVersion);
    }

    return {
      id: this.nextId,
      platform: AppPlatform.ALL,
      minSupportedVersion: '1.0.0',
      latestVersion: '1.0.0',
      forceUpdate: false,
      releaseNotes: undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...payload,
    } as AppVersion;
  }

  async findOne(options: {
    where: Partial<AppVersion>;
    order?: Partial<Record<keyof AppVersion, 'ASC' | 'DESC'>>;
  }): Promise<AppVersion | null> {
    const entries = this.items.filter((item) => {
      return Object.entries(options.where).every(([key, value]) => {
        return item[key as keyof AppVersion] === value;
      });
    });

    if (entries.length === 0) {
      return null;
    }

    if (options.order?.updatedAt) {
      entries.sort((left, right) => {
        return options.order?.updatedAt === 'DESC'
          ? right.updatedAt.getTime() - left.updatedAt.getTime()
          : left.updatedAt.getTime() - right.updatedAt.getTime();
      });
    }

    return entries[0] ?? null;
  }

  async save(entity: AppVersion): Promise<AppVersion> {
    const existingIndex = this.items.findIndex((item) => item.id === entity.id);

    if (existingIndex >= 0) {
      const updatedEntity = {
        ...this.items[existingIndex],
        ...entity,
        updatedAt: new Date(),
      };
      this.items[existingIndex] = updatedEntity;
      return updatedEntity;
    }

    const createdEntity = {
      ...entity,
      id: this.nextId++,
      createdAt: entity.createdAt ?? new Date(),
      updatedAt: new Date(),
    };

    this.items.push(createdEntity);
    return createdEntity;
  }

  async find(options?: {
    order?: Partial<Record<keyof AppVersion, 'ASC' | 'DESC'>>;
  }): Promise<AppVersion[]> {
    const entries = [...this.items];

    if (options?.order?.updatedAt) {
      entries.sort(
        (left, right) => right.updatedAt.getTime() - left.updatedAt.getTime(),
      );
    }

    return entries;
  }
}

describe('AppVersions HTTP flow', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [AppVersionsController],
      providers: [
        AppVersionsService,
        {
          provide: getRepositoryToken(AppVersion),
          useClass: InMemoryAppVersionRepository,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useClass(AllowAllAuthGuard)
      .overrideGuard(RolesGuard)
      .useClass(AllowAllRolesGuard);

    const moduleRef = await moduleBuilder.compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('creates, fetches and updates an app version rule', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/app/version')
      .set('Authorization', 'Bearer test-token')
      .send({
        platform: 'ios',
        minSupportedVersion: '1.0.0',
        latestVersion: '1.2.0',
        forceUpdate: true,
        releaseNotes: 'Important security fixes',
      })
      .expect(201);

    expect(createResponse.body.platform).toBe('ios');
    expect(createResponse.body.forceUpdate).toBe(true);

    const publicResponse = await request(app.getHttpServer())
      .get('/app/version?platform=ios')
      .expect(200);

    expect(publicResponse.body.latestVersion).toBe('1.2.0');
    expect(publicResponse.body.forceUpdate).toBe(true);

    const adminListResponse = await request(app.getHttpServer())
      .get('/app/version/admin/all')
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    expect(adminListResponse.body).toHaveLength(1);

    const createdId = createResponse.body.id as number;

    await request(app.getHttpServer())
      .put(`/app/version/${String(createdId)}`)
      .set('Authorization', 'Bearer test-token')
      .send({
        latestVersion: '1.3.0',
        forceUpdate: false,
      })
      .expect(200);

    const adminDetailResponse = await request(app.getHttpServer())
      .get(`/app/version/admin/${String(createdId)}`)
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    expect(adminDetailResponse.body.latestVersion).toBe('1.3.0');
    expect(adminDetailResponse.body.forceUpdate).toBe(false);
  });

  it('rejects invalid version ranges where minSupportedVersion is greater than latestVersion', async () => {
    const response = await request(app.getHttpServer())
      .post('/app/version')
      .set('Authorization', 'Bearer test-token')
      .send({
        platform: 'android',
        minSupportedVersion: '2.0.0',
        latestVersion: '1.0.0',
        forceUpdate: true,
      })
      .expect(400);

    expect(response.body.message).toBe(
      'minSupportedVersion cannot be greater than latestVersion',
    );
  });
});
