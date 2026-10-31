import { City, Country, State } from '../models/region.models';

export class RegionDao {
  listCountries(): Promise<Country[]> {
    return Country.findAll({
      include: [{ model: State, as: 'states', include: [{ model: City, as: 'cities' }] }],
      order: [
        ['name', 'ASC'],
        [{ model: State, as: 'states' }, 'name', 'ASC'],
        [{ model: State, as: 'states' }, { model: City, as: 'cities' }, 'name', 'ASC'],
      ],
    });
  }

  findCountry(id: string): Promise<Country | null> {
    return Country.findByPk(id);
  }

  findCountryByIso(isoCode: string): Promise<Country | null> {
    return Country.findOne({ where: { isoCode } });
  }

  findState(id: string): Promise<State | null> {
    return State.findByPk(id);
  }

  findCity(id: string): Promise<City | null> {
    return City.findByPk(id);
  }

  findServiceCity(): Promise<City | null> {
    return City.findOne({
      where: { isActive: true },
      include: [{ model: State, as: 'state', include: [{ model: Country, as: 'country' }] }],
      order: [['isDefault', 'DESC'], ['name', 'ASC']],
    });
  }

  createCountry(data: { name: string; isoCode: string; isActive: boolean }): Promise<Country> {
    return Country.create(data);
  }

  createState(data: { countryId: string; name: string; isActive: boolean }): Promise<State> {
    return State.create(data);
  }

  createCity(data: {
    stateId: string;
    name: string;
    lat: string;
    lng: string;
    timezone: string;
    isActive: boolean;
    isDefault: boolean;
  }): Promise<City> {
    return City.create(data);
  }

  async clearDefaultCity(): Promise<void> {
    await City.update({ isDefault: false }, { where: { isDefault: true } });
  }

  saveCountry(country: Country): Promise<Country> {
    return country.save();
  }

  saveState(state: State): Promise<State> {
    return state.save();
  }

  saveCity(city: City): Promise<City> {
    return city.save();
  }
}
