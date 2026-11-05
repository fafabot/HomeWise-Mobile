import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function HomeWiseTabBar() {
  const router = useRouter();
  const pathname = usePathname();

  const tabs: { name: string; route: string; icon: keyof typeof Ionicons.glyphMap; iconActive: keyof typeof Ionicons.glyphMap }[] = [
    { name: 'Início', route: '/', icon: 'home-outline', iconActive: 'home' },
    { name: 'Água', route: '/agua', icon: 'water-outline', iconActive: 'water' },
    { name: 'Energia', route: '/energia', icon: 'flash-outline', iconActive: 'flash' },
    { name: 'Alertas', route: '/alertas', icon: 'warning-outline', iconActive: 'warning' },
    { name: 'Perfil', route: '/perfil', icon: 'person-outline', iconActive: 'person' }
  ];

  if (pathname === '/escanear-qrcode') {
    return null;
  }

  return (
    <View style={styles.tabContainer} accessibilityRole="tablist">
      {tabs.map((tab) => {
        const isActive = pathname === tab.route || (tab.route === '/perfil' && pathname === '/metas');
        return (
          <TouchableOpacity
            key={tab.route}
            style={styles.tabItem}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityLabel={tab.name}
            accessibilityState={{ selected: isActive }}
            onPress={() => router.push(tab.route as any)}
          >
            <View style={[styles.iconWrap, isActive && styles.iconWrapActive]}>
              <Ionicons
                name={isActive ? tab.iconActive : tab.icon}
                size={21}
                color={isActive ? '#22b7d4' : '#7f97a6'}
              />
            </View>
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
              {tab.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#07131b',
    borderTopWidth: 1,
    borderTopColor: '#122a39',
    paddingTop: 8,
    paddingBottom: 20,
    paddingHorizontal: 8,
    justifyContent: 'space-around',
    alignItems: 'center'
  },
  tabItem: {
    alignItems: 'center',
    flex: 1,
    maxWidth: 120,
    gap: 3,
    minHeight: 48,
    justifyContent: 'center'
  },
  iconWrap: {
    width: 52,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center'
  },
  iconWrapActive: {
    backgroundColor: 'rgba(34, 183, 212, 0.14)'
  },
  tabLabel: {
    color: '#7f97a6',
    fontSize: 11,
    fontWeight: '600'
  },
  tabLabelActive: {
    color: '#22b7d4',
    fontWeight: '800'
  }
});
