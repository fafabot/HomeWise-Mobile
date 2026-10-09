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

  return (
    <View style={styles.tabContainer}>
      {tabs.map((tab) => {
        const isActive = pathname === tab.route;
        return (
          <TouchableOpacity
            key={tab.route}
            style={styles.tabItem}
            activeOpacity={0.7}
            onPress={() => router.push(tab.route as any)}
          >
            <Ionicons
              name={isActive ? tab.iconActive : tab.icon}
              size={22}
              color={isActive ? '#22b7d4' : '#64748b'}
            />
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
    borderTopColor: '#132838',
    paddingVertical: 10,
    paddingBottom: 22,
    justifyContent: 'space-around',
    alignItems: 'center'
  },
  tabItem: {
    alignItems: 'center',
    flex: 1,
    gap: 4
  },
  tabLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '500'
  },
  tabLabelActive: {
    color: '#22b7d4',
    fontWeight: '700'
  }
});
