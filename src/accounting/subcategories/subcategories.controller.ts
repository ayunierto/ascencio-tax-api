import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { SubcategoriesService } from './subcategories.service';
import { CreateSubcategoryDto } from './dto/create-subcategory.dto';
import { UpdateSubcategoryDto } from './dto/update-subcategory.dto';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { Role } from 'src/auth/enums/role.enum';

@ApiTags('Accounting - Subcategories')
@Controller('subcategories')
export class SubcategoriesController {
  constructor(private readonly subcategoriesService: SubcategoriesService) {}

  @Post()
  @Auth(Role.Admin, Role.Staff)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new subcategory' })
  @ApiResponse({ status: 201, description: 'Subcategory created successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@Body() createSubcategoryDto: CreateSubcategoryDto) {
    return this.subcategoriesService.create(createSubcategoryDto);
  }

  @Get()
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all subcategories' })
  @ApiResponse({ status: 200, description: 'Return all subcategories' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll() {
    return this.subcategoriesService.findAll();
  }

  @Get(':id')
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a subcategory by ID' })
  @ApiParam({ name: 'id', description: 'Subcategory ID' })
  @ApiResponse({ status: 200, description: 'Return the subcategory' })
  @ApiResponse({ status: 404, description: 'Subcategory not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findOne(@Param('id') id: string) {
    return this.subcategoriesService.findOne(id);
  }

  @Patch(':id')
  @Auth(Role.Admin, Role.Staff)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a subcategory' })
  @ApiParam({ name: 'id', description: 'Subcategory ID' })
  @ApiResponse({ status: 200, description: 'Subcategory updated successfully' })
  @ApiResponse({ status: 404, description: 'Subcategory not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  update(
    @Param('id') id: string,
    @Body() updateSubcategoryDto: UpdateSubcategoryDto,
  ) {
    return this.subcategoriesService.update(id, updateSubcategoryDto);
  }

  @Delete(':id')
  @Auth(Role.Admin, Role.Staff)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a subcategory' })
  @ApiParam({ name: 'id', description: 'Subcategory ID' })
  @ApiResponse({ status: 200, description: 'Subcategory deleted successfully' })
  @ApiResponse({ status: 404, description: 'Subcategory not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  remove(@Param('id') id: string) {
    return this.subcategoriesService.remove(id);
  }
}
