import { Template } from 'meteor/templating';
import { Session } from 'meteor/session';
import { Mongo } from 'meteor/mongo';

Template.fight_page.helpers({
	character_list: function() {
		return CharacterList.find({}, {
			transform: function(character) {
				var character = character.character;
				if (character.fight == null)
					character.fight = {};
				if (character.fight.hp_current == null)
					character.fight.hp_current = character.props.hp;
				character.fight.temp_hp = character.fight.temp_hp || 0;
				return character;
			}
		});
	},

	get_dmg_list: function(main) {
		return [
			{ title: 'Ближним', name: 'damage', visible: true },
			{ title: 'Огнем', name: 'damage_fire', visible: main.fire },
			{ title: 'Водой', name: 'damage_water', visible: main.water },
			{ title: 'Землей', name: 'damage_earth', visible: main.earth },
			{ title: 'Воздухом', name: 'damage_air', visible: main.air },
			{ title: 'Светом', name: 'damage_shine', visible: main.shine },
			{ title: 'Тьмой', name: 'damage_dark', visible: main.dark }
		];
	},

	get_exp_list: function(exp, main) {
		return [
			{ title: 'Персонаж:', value: exp.hero, name: 'exp_hero', visible: true },
			{ title: 'Здоровье:', value: exp.hp, name: 'exp_hp', visible: true },
			{ title: 'Ближнего боя:', value: exp.melle, name: 'exp_melle', visible: true },
			{ title: '', value: null, name: null, visible: true }, // Пустая строка между физ уроном и магией
			{ title: 'Магии огня:', value: exp.magic.fire, name: 'exp_fire', visible: main.fire },
			{ title: 'Магии воды:', value: exp.magic.water, name: 'exp_water', visible: main.water },
			{ title: 'Магии земли:', value: exp.magic.earth, name: 'exp_earth', visible: main.earth },
			{ title: 'Магии воздуха:', value: exp.magic.air, name: 'exp_air', visible: main.air },
			{ title: 'Магии света:', value: exp.magic.shine, name: 'exp_shine', visible: main.shine },
			{ title: 'Магии тьмы:', value: exp.magic.dark, name: 'exp_dark', visible: main.dark },
			{ title: 'Доп 1:', value: exp.other.attr1, name: 'exp_attr1', visible: false },
			{ title: 'Доп 2:', value: exp.other.attr2, name: 'exp_attr2', visible: false },
			{ title: 'Доп 3:', value: exp.other.attr3, name: 'exp_attr3', visible: false }
		];
	},

	get_lvl_list: function(lvl, main) {
		return [
			{ title: 'Героя:', value: lvl.hero, name:'lvl_hero', visible: true },
			{ title: 'Жизней:', value: lvl.hp, name:'lvl_hp', visible: true },
			{ title: 'Попадания:', value: lvl.hit, name:'lvl_hit', visible: true },
			{ title: 'Урона:', value: lvl.dmg, name:'lvl_dmg', visible: true },

			{ title: 'Огня:', value: lvl.fire, name:'lvl_fire', visible: main.fire },
			{ title: 'Воды:', value: lvl.water, name:'lvl_water', visible: main.water },
			{ title: 'Земли:', value: lvl.earth, name:'lvl_earth', visible: main.earth },
			{ title: 'Воздуха:', value: lvl.air, name:'lvl_air', visible: main.air },
			{ title: 'Света:', value: lvl.shine, name:'lvl_shine', visible: main.shine },
			{ title: 'Тьмы:', value: lvl.dark, name:'lvl_dark', visible: main.dark }
		];
	}
});

Template.fight_page.events({
	'click .click_value': function(event) {
		if (!($(event.target).hasClass('rem') || $(event.target).hasClass('add')))
			return;

		var modifier = $(event.target).parents('.modifier_title')[0].getAttribute('name');
		var form = $(event.target).parents('form')[0];
		// Модификатор который отвечает, за то складываем мы статы или вычитаем
		var modifierDamage = 1;
		if ($(event.target).hasClass('rem'))
			modifierDamage = -1;
		var character = CharacterList.findOne({_id: form.name}).character;
		
		if (modifier == 'hp') {
			var value = parseInt(form.hp_change.value || 0) || 1;
			if (character.fight == null)
				character.fight = {};
			character.fight.hp_current = Math.min((character.fight.hp_current || character.props.hp) + value * modifierDamage, character.props.hp);

			// При нанесении урона, увеличим опыт здоровья по формуле увеличичения 
			// лвл_хп = лвл_хп + урон * ((телосложение - 10) / 2 + 1)
			if (modifierDamage == -1) {
				character.exp.hp += value * Math.max(get_modifier(character.props.sta), 1);
			}

			form.hp_change.value = null;
		}
		if (modifier == 'max_hp') {
			var value = parseInt(form.hp_change.value || 0) || 1;
			character.props.hp += value * modifierDamage;
		}
		if (modifier == 'max_temp_hp') {
			var value = parseInt(form.temp_hp_change.value || 0) || 1;
			if (!character.fight)
				character.fight = {};
			character.fight.temp_hp = Math.max((character.fight.temp_hp || 0) + value * modifierDamage, 0);
		}
		if (modifier == 'damage') {
			var value = parseInt(form.damage_value.value || 0) || 1;
			var modifier_value = Math.max(get_modifier(character.main_props == 'str' ? character.props.str : character.props.agi), 1);
			character.exp.melle += value * modifier_value;
		}
		if (['damage_fire', 'damage_water', 'damage_earth', 'damage_air', 'damage_shine', 'damage_dark'].indexOf(modifier) != -1) {
			var anti = {
				'fire': 'water',
				'water': 'fire',
				'earth': 'air',
				'air': 'earth',
				'shine': 'dark',
				'dark': 'shine'
			};
			var school = modifier.replace('damage_', '');
			var value = parseInt(form.damage_value.value || 0) || 1;
			var stats = value * get_modifier(character.props.int);
			character.exp.magic[school] += stats;
			character.exp.magic[anti[school]] = Math.max(character.exp.magic[anti[school]] - Math.round(stats / 2), 0);
		}
 		if (['exp_hp', 'exp_melle', 'exp_hero'].indexOf(modifier) != -1) {
			var value = parseInt(form.exp_value.value || 0) || 1;
			var attr = modifier.replace('exp_', '');
			character.exp[attr] = Math.max(character.exp[attr] + value * modifierDamage, 0)
		}
		if (['exp_fire', 'exp_water','exp_earth', 'exp_air', 'exp_shine', 'exp_dark'].indexOf(modifier) != -1) {
			var value = parseInt(form.exp_value.value || 0) || 1;
			var school = modifier.replace('exp_', '');
			character.exp.magic[school] = Math.max(character.exp.magic[school] + value * modifierDamage, 0);
		}
		if (['exp_attr1', 'exp_attr2', 'exp_attr3'].indexOf(modifier) != -1) {
			var value = parseInt(form.exp_value.value || 0) || 1;
			var attr = modifier.replace('exp_', '');
			character.exp.other[attr] = Math.max(character.exp.other[attr] + value * modifierDamage, 0);
		}
		if (['lvl_hp', 'lvl_hit','lvl_hero', 'lvl_dmg', 'lvl_fire', 'lvl_water',
			'lvl_earth', 'lvl_air', 'lvl_shine', 'lvl_dark'].indexOf(modifier) != -1) {
			var value = modifier.replace('lvl_', '');
			character.lvls[value] = Math.min(Math.max(character.lvls[value] + modifierDamage, 0), 20);
		}
		if (['str', 'agi', 'sta', 'int', 'wis', 'cha', 'mas'].indexOf(modifier) != -1) {
			character.props[modifier] = Math.min(Math.max(character.props[modifier] + modifierDamage, 0), 20);
		}
		$('.fight_page form').trigger('reset'); 
		Meteor.call('UpdateCharacter', form.name, character);
	},

	'click .stats_button': function(event) {
		var $block = $(event.target).parents('.title').find('.character_box');
		var new_pos = $(event.target).position();
		$block.css(new_pos);
		if ($block.hasClass('hide'))
			$block.removeClass('hide');
		else
			$block.addClass('hide');
	},
	'mouseenter .hp': function(event) {
		var $block = $(event.target).find('.character_box');
		var new_pos = $(event.target).position();
		new_pos.left += 30;
		$block.css(new_pos);
		$block.removeClass('hide');
	},

	'mouseleave .title, mouseleave .hp': function() {
		var $block = $(event.target).find('.character_box');
		$block.addClass('hide');
	}
});


// Получить модификатор характеристики
// stats - значение харатеристики
// default_value - значение которое необходим добавить, по умолчанию = 1
function get_modifier(stats, default_value) {
	return parseInt((stats - 10) / 2) + (default_value || 1);
}
